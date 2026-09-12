use std::{future::Future, sync::Arc, time::Duration};

use diesel::prelude::*;
use rdkafka::{Message, consumer::StreamConsumer, producer::FutureProducer};
use serde::Deserialize;

use crate::kafka;
use db::models::NewBidRequestAuditEvent;

type DbPool = diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>;

#[derive(Deserialize)]
struct BidEnvelope {
    request_id: uuid::Uuid,
    auction_id: uuid::Uuid,
    bidder_id: uuid::Uuid,
    username: Option<String>,
    amount: f64,
    timestamp: i64,
}

fn audit_event<M: Message>(message: &M) -> Result<NewBidRequestAuditEvent, String> {
    let raw = message.payload().ok_or("missing bid payload")?;
    let bid: BidEnvelope = serde_json::from_slice(raw).map_err(|error| error.to_string())?;
    if !bid.amount.is_finite() || bid.amount <= 0.0 {
        return Err("amount must be finite and greater than zero".into());
    }
    if message.topic() != auction_kafka::BID_TOPIC
        || message.partition() < 0
        || message.offset() < 0
    {
        return Err("invalid source Kafka position".into());
    }
    let submitted_at = chrono::DateTime::from_timestamp_millis(bid.timestamp)
        .ok_or("invalid bid timestamp")?
        .naive_utc();
    Ok(NewBidRequestAuditEvent {
        source_topic: message.topic().into(),
        source_partition: message.partition(),
        source_offset: message.offset(),
        request_id: bid.request_id,
        auction_id: bid.auction_id,
        bidder_id: bid.bidder_id,
        username: bid.username,
        amount: bid.amount,
        submitted_at,
        payload: String::from_utf8(raw.to_vec()).map_err(|error| error.to_string())?,
    })
}

async fn persist(pool: DbPool, event: NewBidRequestAuditEvent) -> Result<(), String> {
    // Diesel and r2d2 block. Keep database outages off the async executor used
    // by the other consumer groups, timers, and Kafka polling.
    tokio::task::spawn_blocking(move || {
        let mut connection = pool.get().map_err(|error| error.to_string())?;
        diesel::insert_into(db::schema::bid_request_audit_events::table)
            .values(&event)
            .on_conflict_do_nothing()
            .execute(&mut connection)
            .map(|_| ())
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

async fn retry_until_stored<F, Fut>(mut store: F, initial_delay: Duration)
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<(), String>>,
{
    let mut delay = initial_delay;
    while let Err(error) = store().await {
        auction_observability::report_error(
            "notification-worker",
            "request_audit_retry",
            error,
            serde_json::json!({"retry_in_ms": delay.as_millis()}),
        );
        tokio::time::sleep(delay).await;
        delay = (delay * 2).min(Duration::from_secs(30));
    }
}

/// Independent subscription to the input topic: Redis availability, engine
/// decisions, and the decision audit group's offsets never gate this archive.
pub async fn run(pool: DbPool, consumer: StreamConsumer, producer: FutureProducer) {
    consume_with_store(
        Arc::new(consumer),
        producer,
        move |event| persist(pool.clone(), event),
        Duration::from_secs(1),
    )
    .await;
}

async fn consume_with_store<F, Fut>(
    consumer: Arc<StreamConsumer>,
    producer: FutureProducer,
    store: F,
    retry_delay: Duration,
) where
    F: Fn(NewBidRequestAuditEvent) -> Fut,
    Fut: Future<Output = Result<(), String>>,
{
    loop {
        let message = match consumer.recv().await {
            Ok(message) => message,
            Err(error) => {
                auction_observability::report_error(
                    "notification-worker",
                    "request_audit_receive",
                    error.to_string(),
                    serde_json::json!({}),
                );
                continue;
            }
        };
        match audit_event(&message) {
            Ok(event) => {
                retry_until_stored(|| store(event.clone()), retry_delay).await;
            }
            Err(error) => {
                let reason = format!("MALFORMED_BID_REQUEST:{error}");
                retry_until_stored(
                    || async {
                        if kafka::publish_dlq(&producer, &message, &reason).await {
                            Ok(())
                        } else {
                            Err(reason.clone())
                        }
                    },
                    retry_delay,
                )
                .await;
            }
        }
        // Only this group's offset advances. Failed writes and failed DLQ
        // delivery retry the same record; no later record can commit past it.
        kafka::commit(&consumer, &message);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rdkafka::message::{OwnedMessage, Timestamp};
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };

    fn message(payload: serde_json::Value, offset: i64) -> OwnedMessage {
        OwnedMessage::new(
            Some(payload.to_string().into_bytes()),
            None,
            auction_kafka::BID_TOPIC.into(),
            Timestamp::NotAvailable,
            2,
            offset,
            None,
        )
    }

    fn bid() -> serde_json::Value {
        serde_json::json!({
            "request_id": uuid::Uuid::new_v4(),
            "auction_id": uuid::Uuid::new_v4(),
            "bidder_id": uuid::Uuid::new_v4(),
            "amount": 100.0,
            "timestamp": 1_787_654_321_000_i64,
            "trace_context": {"traceparent": "original context"},
        })
    }

    #[test]
    fn raw_requests_are_auditable_without_an_engine_decision() {
        let payload = bid();
        let first = audit_event(&message(payload.clone(), 7)).unwrap();
        let resubmission = audit_event(&message(payload.clone(), 8)).unwrap();
        assert_eq!(first.request_id, resubmission.request_id);
        assert_ne!(first.source_offset, resubmission.source_offset);
        assert_eq!(first.source_partition, 2);
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&first.payload).unwrap(),
            payload
        );
    }

    #[test]
    fn malformed_requests_do_not_reach_the_database() {
        for (field, value) in [
            ("request_id", serde_json::json!("invalid")),
            ("bidder_id", serde_json::json!("invalid")),
            ("amount", serde_json::json!(-1)),
            ("timestamp", serde_json::json!(i64::MAX)),
        ] {
            let mut payload = bid();
            payload[field] = value;
            assert!(audit_event(&message(payload, 0)).is_err(), "{field}");
        }
    }

    #[tokio::test]
    async fn retries_wait_for_storage_and_do_not_block_another_consumer() {
        let attempts = Arc::new(AtomicUsize::new(0));
        let retry_attempts = attempts.clone();
        let blocked = tokio::spawn(async move {
            retry_until_stored(
                || {
                    let attempt = retry_attempts.fetch_add(1, Ordering::SeqCst);
                    async move {
                        if attempt < 2 {
                            Err("database offline".into())
                        } else {
                            Ok(())
                        }
                    }
                },
                Duration::from_millis(20),
            )
            .await;
        });
        while attempts.load(Ordering::SeqCst) == 0 {
            tokio::task::yield_now().await;
        }
        retry_until_stored(|| async { Ok(()) }, Duration::from_millis(1)).await;
        assert!(!blocked.is_finished());
        tokio::time::timeout(Duration::from_secs(2), blocked)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(attempts.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn kafka_fanout_keeps_consumer_offsets_and_retries_independent() {
        use rdkafka::{
            ClientConfig, Offset, TopicPartitionList, consumer::Consumer, mocking::MockCluster,
        };
        use std::sync::atomic::AtomicBool;

        let cluster = MockCluster::new(1).unwrap();
        cluster
            .create_topic(auction_kafka::BID_TOPIC, 1, 1)
            .unwrap();
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", cluster.bootstrap_servers())
            .create()
            .unwrap();
        let make_consumer = |group| -> Arc<StreamConsumer> {
            let consumer: StreamConsumer = ClientConfig::new()
                .set("bootstrap.servers", cluster.bootstrap_servers())
                .set("group.id", group)
                .set("enable.auto.commit", "false")
                .set("enable.auto.offset.store", "false")
                .set("auto.offset.reset", "earliest")
                .create()
                .unwrap();
            consumer.subscribe(&[auction_kafka::BID_TOPIC]).unwrap();
            Arc::new(consumer)
        };
        let engine = make_consumer(auction_kafka::ENGINE_GROUP);
        let audit = make_consumer(auction_kafka::BID_REQUEST_AUDIT_GROUP);
        let redis_ready = Arc::new(AtomicBool::new(false));
        let database_ready = Arc::new(AtomicBool::new(true));
        let (stored_tx, mut stored_rx) = tokio::sync::mpsc::unbounded_channel();
        let start = |consumer: Arc<StreamConsumer>, ready: Arc<AtomicBool>, label| {
            let stored_tx = stored_tx.clone();
            let producer = producer.clone();
            tokio::spawn(async move {
                consume_with_store(
                    consumer,
                    producer,
                    move |event| {
                        let ready = ready.load(Ordering::SeqCst);
                        let stored_tx = stored_tx.clone();
                        async move {
                            if !ready {
                                return Err("sink unavailable".into());
                            }
                            stored_tx.send((label, event.source_offset)).unwrap();
                            Ok(())
                        }
                    },
                    Duration::from_millis(20),
                )
                .await;
            })
        };
        // Exercise the same Kafka delivery/commit loop with independently
        // failing sinks, without relying on a running Redis/Postgres service.
        let engine_task = start(engine.clone(), redis_ready.clone(), "redis");
        let audit_task = start(audit.clone(), database_ready.clone(), "audit");
        let receive = |consumer: &Arc<StreamConsumer>| {
            let mut positions = TopicPartitionList::new();
            positions.add_partition(auction_kafka::BID_TOPIC, 0);
            consumer
                .committed_offsets(positions, Duration::from_secs(2))
                .unwrap()
                .find_partition(auction_kafka::BID_TOPIC, 0)
                .unwrap()
                .offset()
        };
        let first = bid();
        auction_kafka::publish(
            &producer,
            auction_kafka::BID_TOPIC,
            first["auction_id"].as_str().unwrap(),
            first.to_string().as_bytes(),
        )
        .await
        .unwrap();
        assert_eq!(
            tokio::time::timeout(Duration::from_secs(15), stored_rx.recv())
                .await
                .unwrap(),
            Some(("audit", 0))
        );
        assert_eq!(receive(&engine), Offset::Invalid);
        redis_ready.store(true, Ordering::SeqCst);
        assert_eq!(
            tokio::time::timeout(Duration::from_secs(5), stored_rx.recv())
                .await
                .unwrap(),
            Some(("redis", 0))
        );

        // Wait for successful commits before reversing which sink is down.
        tokio::time::timeout(Duration::from_secs(5), async {
            while receive(&audit) != Offset::Offset(1) || receive(&engine) != Offset::Offset(1) {
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        })
        .await
        .unwrap();
        database_ready.store(false, Ordering::SeqCst);
        let second = bid();
        auction_kafka::publish(
            &producer,
            auction_kafka::BID_TOPIC,
            second["auction_id"].as_str().unwrap(),
            second.to_string().as_bytes(),
        )
        .await
        .unwrap();
        assert_eq!(
            tokio::time::timeout(Duration::from_secs(5), stored_rx.recv())
                .await
                .unwrap(),
            Some(("redis", 1))
        );
        assert_eq!(receive(&audit), Offset::Offset(1));
        database_ready.store(true, Ordering::SeqCst);
        assert_eq!(
            tokio::time::timeout(Duration::from_secs(5), stored_rx.recv())
                .await
                .unwrap(),
            Some(("audit", 1))
        );
        assert!(stored_rx.try_recv().is_err());
        engine_task.abort();
        audit_task.abort();
        let _ = engine_task.await;
        let _ = audit_task.await;
    }
}
