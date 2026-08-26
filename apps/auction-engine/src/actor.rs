use std::{
    panic::AssertUnwindSafe,
    sync::{Arc, atomic::Ordering},
};

use futures_util::FutureExt;
use redis::AsyncCommands;
use tokio::sync::{Mutex, mpsc};
use tracing::{Instrument, info_span};
use uuid::Uuid;

use crate::{
    ledger,
    registry::{
        AuctionRegistry, CachePaddedAuctionState, STATE_ACTIVE, STATE_CLOSED, STATE_ENDING,
        STATE_INITIALIZING,
    },
    types::{
        ActorExit, AuctionRuntime, AuctionTask, AuctionTaskResult, AuctionType, LedgerWrite,
        is_better_bid,
    },
};

pub fn start_supervisor(
    registry: Arc<AuctionRegistry>,
    auction_id: Uuid,
    generation: u64,
    state: Arc<CachePaddedAuctionState>,
    receiver: Arc<Mutex<mpsc::Receiver<AuctionTask>>>,
) {
    tokio::spawn(async move {
        let mut restarts = 0_u32;
        loop {
            let registry_ref = registry.clone();
            let receiver_ref = receiver.clone();
            let state_ref = state.clone();
            let supervisor_handle = tokio::spawn(async move {
                AssertUnwindSafe(run_actor_loop(
                    auction_id,
                    receiver_ref,
                    registry_ref.redis_pool.clone(),
                    registry_ref.kafka_producer.clone(),
                    state_ref,
                ))
                .catch_unwind()
                .await
            });

            match supervisor_handle.await {
                Ok(Ok(exit)) => {
                    println!("[auction-engine] actor {auction_id} exited: {exit:?}");
                    registry.remove_if_generation(auction_id, generation);
                    break;
                }
                Ok(Err(_)) => {
                    restarts = restarts.saturating_add(1);
                    auction_observability::report_error(
                        "auction-engine",
                        "actor_panic_restart",
                        "auction actor panicked and will restart",
                        serde_json::json!({
                            "auction_id": auction_id,
                            "generation": generation,
                            "restart": restarts,
                        }),
                    );
                }
                Err(error) if error.is_panic() => {
                    restarts = restarts.saturating_add(1);
                    auction_observability::report_error(
                        "auction-engine",
                        "actor_join_panic",
                        error.to_string(),
                        serde_json::json!({
                            "auction_id": auction_id,
                            "generation": generation,
                            "restart": restarts,
                        }),
                    );
                }
                Err(error) => {
                    auction_observability::report_error(
                        "auction-engine",
                        "actor_cancelled",
                        error.to_string(),
                        serde_json::json!({
                            "auction_id": auction_id,
                            "generation": generation,
                        }),
                    );
                    registry.remove_if_generation(auction_id, generation);
                    break;
                }
            }
            tokio::time::sleep(AuctionRegistry::restart_delay(restarts)).await;
        }
    });
}

async fn run_actor_loop(
    auction_id: Uuid,
    receiver: Arc<Mutex<mpsc::Receiver<AuctionTask>>>,
    redis_pool: bb8::Pool<bb8_redis::RedisConnectionManager>,
    kafka_producer: rdkafka::producer::FutureProducer,
    state: Arc<CachePaddedAuctionState>,
) -> ActorExit {
    state.lifecycle.store(STATE_INITIALIZING, Ordering::Release);
    let mut runtime = load_runtime(auction_id, &redis_pool).await;
    state.lifecycle.store(STATE_ACTIVE, Ordering::Release);
    let mut receiver = receiver.lock().await;

    loop {
        let now = chrono::Utc::now().timestamp_millis();
        if now >= runtime.end_timestamp_ms {
            state.lifecycle.store(STATE_ENDING, Ordering::Release);
            reject_queued_tasks(&mut receiver, "AUCTION_ENDED");
            ledger::close_auction(
                auction_id,
                runtime.auction_type,
                runtime.reserve_price,
                &redis_pool,
                &kafka_producer,
            )
            .await
            .unwrap_or_else(|error| panic!("auction close failed: {error}"));
            state.lifecycle.store(STATE_CLOSED, Ordering::Release);
            return ActorExit::AuctionEnded;
        }

        let until_end = std::time::Duration::from_millis(
            u64::try_from(runtime.end_timestamp_ms - now).unwrap_or(0),
        );
        let task = tokio::select! {
            task = receiver.recv() => match task {
                Some(task) => task,
                None => return ActorExit::ChannelClosed,
            },
            _ = tokio::time::sleep(until_end) => {
                state.lifecycle.store(STATE_ENDING, Ordering::Release);
                reject_queued_tasks(&mut receiver, "AUCTION_ENDED");
                ledger::close_auction(auction_id, runtime.auction_type, runtime.reserve_price, &redis_pool, &kafka_producer)
                    .await
                    .unwrap_or_else(|error| panic!("auction close failed: {error}"));
                state.lifecycle.store(STATE_CLOSED, Ordering::Release);
                return ActorExit::AuctionEnded;
            }
        };

        if task.bid.auction_id != auction_id {
            let _ = task.respond_to.send(AuctionTaskResult::Rejected(
                "AUCTION_ID_MISMATCH".to_string(),
            ));
            continue;
        }

        let is_executed = is_better_bid(
            runtime.auction_type,
            runtime.current_price,
            task.bid.amount,
            runtime.minimum_bid_step,
        );
        let bid_span = info_span!(
            "process_bid",
            auction.id = %auction_id,
            bidder.id = %task.bid.bidder_id,
            request.id = %task.request_id,
            kafka.partition = task.source_partition,
            kafka.offset = task.source_offset,
            bid.amount = task.bid.amount,
        );
        auction_observability::set_parent_from_trace_context(&bid_span, &task.trace_context);
        let processing = AssertUnwindSafe(ledger::write_bid(
            &task,
            runtime.auction_type,
            is_executed,
            runtime.current_price,
            &redis_pool,
            &kafka_producer,
        ))
        .catch_unwind()
        .instrument(bid_span.clone())
        .await;

        match processing {
            Ok(Ok(write)) => {
                if write == LedgerWrite::Applied && is_executed {
                    runtime.current_price = task.bid.amount;
                }
                let _ = task.respond_to.send(AuctionTaskResult::Committed);
            }
            Ok(Err(error)) => {
                bid_span.in_scope(|| {
                    auction_observability::report_error(
                        "auction-engine",
                        "bid_processing",
                        error.clone(),
                        serde_json::json!({
                            "auction_id": auction_id,
                            "request_id": task.request_id,
                        }),
                    );
                });
                let _ = task.respond_to.send(AuctionTaskResult::Retryable(error));
            }
            Err(payload) => {
                std::panic::resume_unwind(payload);
            }
        }
    }
}

fn reject_queued_tasks(receiver: &mut mpsc::Receiver<AuctionTask>, reason: &str) {
    while let Ok(task) = receiver.try_recv() {
        let _ = task
            .respond_to
            .send(AuctionTaskResult::Rejected(reason.to_string()));
    }
}

async fn load_runtime(
    auction_id: Uuid,
    pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
) -> AuctionRuntime {
    let id = auction_id.to_string();
    let mut connection = pool
        .get()
        .await
        .unwrap_or_else(|error| panic!("Redis pool unavailable while restoring actor: {error}"));

    let state_key = auction_redis::format_auction_state_key(&id);
    let mut state: Option<String> = connection.get(&state_key).await.unwrap_or(None);
    if state.is_none() {
        state = connection
            .hget(auction_redis::AUCTION_STATE_HASH_KEY, &id)
            .await
            .unwrap_or(None);
    }

    let mut end_timestamp_ms = chrono::Utc::now().timestamp_millis() + 180_000;
    let mut auction_type = AuctionType::Reverse;
    let mut current_price = f64::MAX;
    let mut minimum_bid_step = 1.0;
    let mut reserve_price = None;
    if let Some(state) =
        state.and_then(|value| serde_json::from_str::<serde_json::Value>(&value).ok())
    {
        let auction_record = state.get("auction").or_else(|| state.get("shipment"));
        if let Some(auction_record) = auction_record {
            if let Some(price) = auction_record
                .get("starting_price")
                .and_then(|value| value.as_f64())
            {
                current_price = price;
            }
            if let Some(value) = auction_record
                .get("auction_end_time")
                .and_then(|value| value.as_str())
            {
                let value = value.trim_end_matches('Z');
                if let Ok(end) =
                    chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S%.f").or_else(
                        |_| chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S"),
                    )
                {
                    end_timestamp_ms = end.and_utc().timestamp_millis();
                }
            }
        }
        let config = state
            .get("config")
            .or_else(|| {
                state
                    .get("auction")
                    .filter(|value| value.get("auction_type").is_some())
            })
            .or(auction_record);
        if let Some(config) = config {
            auction_type = match config
                .get("auction_type")
                .and_then(|value| value.as_str())
                .unwrap_or("REVERSE")
                .to_ascii_uppercase()
                .as_str()
            {
                "FORWARD" => AuctionType::Forward,
                _ => AuctionType::Reverse,
            };
            minimum_bid_step = config
                .get("minimum_bid_step")
                .and_then(|value| value.as_f64())
                .filter(|value| value.is_finite() && *value > 0.0)
                .unwrap_or(1.0);
            reserve_price = config
                .get("reserve_price")
                .and_then(|value| value.as_f64())
                .filter(|value| value.is_finite() && *value >= 0.0);
        }
    }

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
    if let Some(amount) = bids
        .first()
        .and_then(|value| serde_json::from_str::<serde_json::Value>(value).ok())
        .and_then(|value| value.get("bid")?.get("amount")?.as_f64())
    {
        current_price = amount;
    }

    AuctionRuntime {
        auction_type,
        current_price,
        minimum_bid_step,
        reserve_price,
        end_timestamp_ms,
    }
}
