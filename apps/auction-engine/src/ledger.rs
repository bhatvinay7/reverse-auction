use rdkafka::producer::FutureProducer;
use redis::AsyncCommands;
use serde_json::json;
use uuid::Uuid;

use crate::types::{AuctionTask, AuctionType, LedgerWrite};

const DEDUPE_TTL_SECS: usize = 86_400;

struct RedisConnection(bb8::Pool<bb8_redis::RedisConnectionManager>);

impl socketioxide_emitter::Driver for RedisConnection {
    type Error = redis::RedisError;

    async fn emit(&self, channel: String, data: Vec<u8>) -> Result<(), Self::Error> {
        let mut connection =
            self.0.get().await.map_err(|error| {
                redis::RedisError::from(std::io::Error::other(error.to_string()))
            })?;
        connection
            .publish::<_, _, redis::Value>(channel, data)
            .await?;
        Ok(())
    }
}

pub async fn write_bid(
    task: &AuctionTask,
    auction_type: AuctionType,
    is_executed: bool,
    previous_price: f64,
    pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
    producer: &FutureProducer,
) -> Result<LedgerWrite, String> {
    let auction_id = task.bid.auction_id.to_string();
    let dedupe_key = format!("{{{auction_id}}}:processed:{}", task.request_id);
    let payload = json!({
        "schema_version": 1,
        "event_type": "bid_decision",
        "request_id": task.request_id,
        "bid": task.bid,
        "auction_type": auction_type,
        "is_executed": is_executed,
        "rejection_reason": if is_executed { None } else { Some("BID_DOES_NOT_IMPROVE_PRICE") },
        "previous_price": previous_price,
        "resulting_price": if is_executed { task.bid.amount } else { previous_price },
        "processed_at": chrono::Utc::now().timestamp_millis(),
        "source_topic": task.source_topic,
        "source_partition": task.source_partition,
        "source_offset": task.source_offset,
    });
    let payload_json = payload.to_string();

    // Rejected bids are audit records, not live auction state. They go
    // directly to the durable decision topic and are never written to Redis
    // Streams, sorted sets, or idempotency keys. Re-delivery can publish the
    // same decision again; the PostgreSQL audit primary key removes it.
    if !is_executed {
        // A replay of a previously accepted bid no longer improves the actor's
        // restored/current price. Check the accepted-only idempotency record
        // before classifying it as a fresh rejection and republish the exact
        // original decision when present.
        let mut connection = pool.get().await.map_err(|error| error.to_string())?;
        let accepted_decision: Option<String> = connection
            .get(&dedupe_key)
            .await
            .map_err(|error| error.to_string())?;
        drop(connection);
        if let Some(accepted_decision) = accepted_decision {
            auction_kafka::publish(
                producer,
                auction_kafka::BID_DECISION_TOPIC,
                &auction_id,
                accepted_decision.as_bytes(),
            )
            .await
            .map_err(|error| format!("bid audit replay publish failed: {error}"))?;
            return Ok(LedgerWrite::Duplicate);
        }

        auction_kafka::publish(
            producer,
            auction_kafka::BID_DECISION_TOPIC,
            &auction_id,
            payload_json.as_bytes(),
        )
        .await
        .map_err(|error| format!("bid audit publish failed: {error}"))?;

        publish_notification(task, auction_type, false, &auction_id, producer).await;
        publish_live_update(pool, task, &auction_id, &payload).await;
        return Ok(LedgerWrite::Applied);
    }

    let script = redis::Script::new(
        r#"
        local existing = redis.call('GET', KEYS[1])
        if existing then
            return {0, existing}
        end
        redis.call('XADD', KEYS[2], '*', 'bid_data', ARGV[1])
        redis.call('XADD', KEYS[3], '*', 'bid_data', ARGV[1])
        redis.call('ZADD', KEYS[4], ARGV[2], ARGV[1])
        redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
        return {1, ARGV[1]}
        "#,
    );
    let mut connection = pool.get().await.map_err(|error| error.to_string())?;
    let (applied, stored_payload): (i32, String) = script
        .key(&dedupe_key)
        .key(auction_redis::format_sync_stream(&auction_id))
        .key(auction_redis::format_live_stream(&auction_id))
        .key(auction_redis::format_zset_key(&auction_id))
        .arg(&payload_json)
        .arg(task.bid.amount)
        .arg(DEDUPE_TTL_SECS)
        .invoke_async(&mut *connection)
        .await
        .map_err(|error| error.to_string())?;
    drop(connection);

    // This publish is part of bid processing, not a best-effort notification.
    // If it fails, the source Kafka offset remains uncommitted. On retry the
    // Redis idempotency record returns this exact payload, so the bid is not
    // recalculated or applied twice.
    auction_kafka::publish(
        producer,
        auction_kafka::BID_DECISION_TOPIC,
        &auction_id,
        stored_payload.as_bytes(),
    )
    .await
    .map_err(|error| format!("bid audit publish failed: {error}"))?;

    if applied == 0 {
        return Ok(LedgerWrite::Duplicate);
    }

    publish_notification(task, auction_type, true, &auction_id, producer).await;
    publish_live_update(pool, task, &auction_id, &payload).await;
    Ok(LedgerWrite::Applied)
}

async fn publish_notification(
    task: &AuctionTask,
    auction_type: AuctionType,
    is_executed: bool,
    auction_id: &str,
    producer: &FutureProducer,
) {
    let notification = json!({
        "request_id": task.request_id,
        "event_type": "bid_placed",
        "auction_id": auction_id,
        "auction_type": auction_type,
        "bidder_id": task.bid.bidder_id,
        "amount": task.bid.amount,
        "is_executed": is_executed,
        "timestamp": task.bid.timestamp,
        "message": if is_executed { "A valid bid was placed." } else { "A bid was rejected because it did not improve the current price." },
    })
    .to_string();
    if let Err(error) = auction_kafka::publish(
        producer,
        auction_kafka::NOTIFICATION_TOPIC,
        auction_id,
        notification.as_bytes(),
    )
    .await
    {
        auction_observability::report_error(
            "auction-engine",
            "notification_publish",
            error,
            json!({
                "auction_id": auction_id,
                "request_id": task.request_id,
            }),
        );
    }
}

async fn publish_live_update(
    pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
    task: &AuctionTask,
    auction_id: &str,
    payload: &serde_json::Value,
) {
    let pubsub = json!({ "auction_id": auction_id, "payload": payload }).to_string();
    match pool.get().await {
        Ok(mut connection) => {
            if let Err(error) = connection
                .publish::<_, _, ()>("auction:updates", pubsub)
                .await
            {
                auction_observability::report_error(
                    "auction-engine",
                    "live_update_publish",
                    error.to_string(),
                    json!({
                        "auction_id": auction_id,
                        "request_id": task.request_id,
                    }),
                );
            }
        }
        Err(error) => {
            auction_observability::report_error(
                "auction-engine",
                "live_update_redis_pool",
                error.to_string(),
                json!({
                    "auction_id": auction_id,
                    "request_id": task.request_id,
                }),
            );
        }
    }
}

pub async fn close_auction(
    auction_id: Uuid,
    auction_type: AuctionType,
    reserve_price: Option<f64>,
    pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
    producer: &FutureProducer,
) -> Result<(), String> {
    let id = auction_id.to_string();
    let mut connection = pool.get().await.map_err(|error| error.to_string())?;
    let bids: Vec<String> = match auction_type {
        AuctionType::Reverse => connection
            .zrange(auction_redis::format_zset_key(&id), 0, 0)
            .await
            .unwrap_or_default(),
        AuctionType::Forward => connection
            .zrevrange(auction_redis::format_zset_key(&id), 0, 0)
            .await
            .unwrap_or_default(),
    };
    let mut winner = bids
        .first()
        .and_then(|value| serde_json::from_str::<serde_json::Value>(value).ok());
    if auction_type == AuctionType::Forward
        && reserve_price.is_some_and(|reserve| {
            winner
                .as_ref()
                .and_then(|value| value.get("bid"))
                .and_then(|value| value.get("amount"))
                .and_then(|value| value.as_f64())
                .is_none_or(|amount| amount < reserve)
        })
    {
        winner = None;
    }
    let state: Option<String> = connection
        .hget(auction_redis::AUCTION_STATE_HASH_KEY, &id)
        .await
        .unwrap_or(None);
    if let Some(mut state) =
        state.and_then(|value| serde_json::from_str::<serde_json::Value>(&value).ok())
    {
        if let Some(auction) = state.get_mut("auction") {
            auction["status"] = json!("Completed");
        } else if let Some(auction) = state.get_mut("shipment") {
            auction["status"] = json!("Completed");
        }
        if let Some(winner) = &winner {
            state["winner"] = winner.clone();
        }
        connection
            .hset::<_, _, _, ()>(
                auction_redis::AUCTION_STATE_HASH_KEY,
                &id,
                state.to_string(),
            )
            .await
            .map_err(|error| error.to_string())?;
    }

    let sync_payload = json!({ "auction_id": id, "auction_type": auction_type }).to_string();
    auction_kafka::publish(
        producer,
        auction_kafka::SYNC_TOPIC,
        &id,
        sync_payload.as_bytes(),
    )
    .await?;

    let emitter = socketioxide_emitter::IoEmitter::new();
    emitter
        .to(id)
        .emit(
            "auction_closed",
            &json!({
                "event": "auction_closed",
                "auction_type": auction_type,
                "reserve_met": winner.is_some(),
                "data": winner,
            }),
            &RedisConnection(pool.clone()),
        )
        .await
        .map_err(|error| error.to_string())?;
    Ok(())
}
