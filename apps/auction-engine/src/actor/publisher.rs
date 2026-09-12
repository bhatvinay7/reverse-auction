use std::sync::Arc;
use std::time::Duration;

use redis::AsyncCommands;
use uuid::Uuid;

/// Background Kafka publisher loop for a single auction actor.
///
/// This task runs alongside [`super::loop_::run_actor_loop`] under the same
/// supervisor. It is the only code that performs network I/O to Kafka for bid
/// decisions, ensuring the actor loop is never blocked on Kafka availability.
///
/// ## Protocol
///
/// 1. On startup it reads all entries from `{auction_id}:pending_kafka_events`
///    starting at `0-0` to recover any events that survived a crash.
/// 2. For each event it publishes to `BID_DECISION_TOPIC` and
///    `NOTIFICATION_TOPIC`, retrying with exponential back-off until Kafka
///    acknowledges.
/// 3. Only after successful publish does it `XDEL` the entry from the stream.
/// 4. When the stream is empty, it parks on [`tokio::sync::Notify`]. The actor
///    loop calls `notify.notify_one()` after every successful Redis write.
pub(super) async fn run_kafka_publisher_loop(
    auction_id: Uuid,
    redis_pool: bb8::Pool<bb8_redis::RedisConnectionManager>,
    kafka_producer: rdkafka::producer::FutureProducer,
    notify: Arc<tokio::sync::Notify>,
) {
    let pending_stream_key = format!("{{{auction_id}}}:pending_kafka_events");
    let id_str = auction_id.to_string();

    loop {
        // ── 1. Read pending events ───────────────────────────────────────
        let entries = {
            let mut connection = match redis_pool.get().await {
                Ok(conn) => conn,
                Err(error) => {
                    auction_observability::report_error(
                        "auction-engine",
                        "publisher_redis_pool",
                        error.to_string(),
                        serde_json::json!({ "auction_id": id_str }),
                    );
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    continue;
                }
            };
            let result: redis::RedisResult<redis::streams::StreamReadReply> = connection
                .xread_options(
                    &[&pending_stream_key],
                    &["0-0"],
                    &redis::streams::StreamReadOptions::default(),
                )
                .await;
            // Connection released here — before any Kafka I/O.
            match result {
                Ok(reply) => reply
                    .keys
                    .into_iter()
                    .flat_map(|k| k.ids)
                    .collect::<Vec<_>>(),
                Err(error) => {
                    auction_observability::report_error(
                        "auction-engine",
                        "publisher_xread",
                        error.to_string(),
                        serde_json::json!({ "auction_id": id_str }),
                    );
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    continue;
                }
            }
        };

        if entries.is_empty() {
            // Park until the actor loop signals a new write.
            notify.notified().await;
            continue;
        }

        // ── 2. Publish each entry to Kafka, then ack ─────────────────────
        for stream_id in entries {
            let payload_str = extract_payload_str(&stream_id);
            if let Ok(payload) = serde_json::from_str::<serde_json::Value>(&payload_str) {
                publish_decision_with_retry(&kafka_producer, &id_str, payload_str.as_bytes()).await;
                publish_notification_with_retry(&payload, &id_str, &kafka_producer).await;
            }

            // ── 3. Ack only after both publishes succeed ──────────────────
            let mut connection = match redis_pool.get().await {
                Ok(conn) => conn,
                Err(error) => {
                    auction_observability::report_error(
                        "auction-engine",
                        "publisher_xdel_pool",
                        error.to_string(),
                        serde_json::json!({ "auction_id": id_str, "stream_id": stream_id.id }),
                    );
                    // Will be re-processed on next loop (idempotent because
                    // the Kafka publish side is also idempotent).
                    continue;
                }
            };
            if let Err(error) = redis::AsyncCommands::xdel::<_, _, ()>(
                &mut *connection,
                &pending_stream_key,
                &[&stream_id.id],
            )
            .await
            {
                auction_observability::report_error(
                    "auction-engine",
                    "publisher_xdel",
                    error.to_string(),
                    serde_json::json!({ "auction_id": id_str, "stream_id": stream_id.id }),
                );
            }
        }
    }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

fn extract_payload_str(stream_id: &redis::streams::StreamId) -> String {
    stream_id
        .map
        .get("payload")
        .and_then(|v| match v {
            redis::Value::BulkString(d) => String::from_utf8(d.clone()).ok(),
            _ => None,
        })
        .unwrap_or_default()
}

async fn publish_decision_with_retry(
    producer: &rdkafka::producer::FutureProducer,
    auction_id: &str,
    payload: &[u8],
) {
    let mut attempts = 0_u32;
    loop {
        match auction_kafka::publish(producer, auction_kafka::BID_DECISION_TOPIC, auction_id, payload).await {
            Ok(_) => return,
            Err(error) => {
                attempts = attempts.saturating_add(1);
                let delay = Duration::from_millis((100_u64 << attempts.min(6)).min(5_000));
                auction_observability::report_error(
                    "auction-engine",
                    "publisher_decision_retry",
                    error,
                    serde_json::json!({ "auction_id": auction_id, "attempt": attempts }),
                );
                tokio::time::sleep(delay).await;
            }
        }
    }
}

async fn publish_notification_with_retry(
    payload: &serde_json::Value,
    auction_id: &str,
    producer: &rdkafka::producer::FutureProducer,
) {
    let request_id   = payload.get("request_id").and_then(|v| v.as_str()).unwrap_or_default();
    let auction_type = payload.get("auction_type").and_then(|v| v.as_str()).unwrap_or_default();
    let is_executed  = payload.get("is_executed").and_then(|v| v.as_bool()).unwrap_or(false);
    let empty_bid    = serde_json::json!({});
    let bid          = payload.get("bid").unwrap_or(&empty_bid);
    let bidder_id    = bid.get("bidder_id").and_then(|v| v.as_str()).unwrap_or_default();
    let amount       = bid.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let timestamp    = bid.get("timestamp").and_then(|v| v.as_i64()).unwrap_or(0);

    let notification = serde_json::json!({
        "request_id":   request_id,
        "event_type":   "bid_placed",
        "auction_id":   auction_id,
        "auction_type": auction_type,
        "bidder_id":    bidder_id,
        "amount":       amount,
        "is_executed":  is_executed,
        "timestamp":    timestamp,
        "message": if is_executed {
            "A valid bid was placed."
        } else {
            "A bid was rejected because it did not improve the current price."
        },
    })
    .to_string();

    let mut attempts = 0_u32;
    loop {
        match auction_kafka::publish(
            producer,
            auction_kafka::NOTIFICATION_TOPIC,
            auction_id,
            notification.as_bytes(),
        )
        .await
        {
            Ok(_) => return,
            Err(error) => {
                attempts = attempts.saturating_add(1);
                let delay = Duration::from_millis((100_u64 << attempts.min(6)).min(5_000));
                auction_observability::report_error(
                    "auction-engine",
                    "publisher_notification_retry",
                    error,
                    serde_json::json!({ "auction_id": auction_id, "attempt": attempts }),
                );
                tokio::time::sleep(delay).await;
            }
        }
    }
}
