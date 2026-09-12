use std::{panic::AssertUnwindSafe, sync::Arc, sync::atomic::Ordering};

use futures_util::FutureExt;
use tokio::sync::{Mutex, mpsc};
use tracing::{Instrument, info_span};
use uuid::Uuid;

use crate::{
    ledger,
    registry::{
        CachePaddedAuctionState, STATE_ACTIVE, STATE_CLOSED, STATE_ENDING, STATE_INITIALIZING,
    },
    types::{ActorExit, AuctionTask, AuctionTaskResult, LedgerWrite, is_better_bid},
};

use super::runtime::load_runtime;

/// Main bid-processing loop for a single auction actor.
///
/// Holds the mutex-guarded receiver for the duration of its lifetime,
/// ensuring serial, ordered processing of bids. On each iteration it:
///
/// 1. Checks whether the auction deadline has passed.
/// 2. Blocks on the next [`AuctionTask`] or the deadline timer.
/// 3. Validates the bid rule (`is_better_bid`).
/// 4. Calls [`ledger::write_bid`] which atomically writes to Redis and enqueues
///    the decision event onto `{auction_id}:pending_kafka_events`.
/// 5. Notifies the sibling publisher task via [`tokio::sync::Notify`].
/// 6. Replies `Committed` to the consumer.
pub(super) async fn run_actor_loop(
    auction_id: Uuid,
    receiver: Arc<Mutex<mpsc::Receiver<AuctionTask>>>,
    redis_pool: bb8::Pool<bb8_redis::RedisConnectionManager>,
    kafka_producer: rdkafka::producer::FutureProducer,
    state: Arc<CachePaddedAuctionState>,
    notify_publisher: Arc<tokio::sync::Notify>,
) -> ActorExit {
    state.lifecycle.store(STATE_INITIALIZING, Ordering::Release);
    let mut runtime = load_runtime(auction_id, &redis_pool).await;
    state.lifecycle.store(STATE_ACTIVE, Ordering::Release);
    let mut receiver = receiver.lock().await;

    loop {
        let now = chrono::Utc::now().timestamp_millis();
        if now >= runtime.end_timestamp_ms {
            return close_and_exit(
                auction_id,
                &mut receiver,
                &redis_pool,
                &kafka_producer,
                &state,
                runtime.auction_type,
                runtime.reserve_price,
            )
            .await;
        }

        let until_end = std::time::Duration::from_millis(
            u64::try_from(runtime.end_timestamp_ms - now).unwrap_or(0),
        );

        let task = tokio::select! {
            task = receiver.recv() => match task {
                Some(task) => task,
                None       => return ActorExit::ChannelClosed,
            },
            _ = tokio::time::sleep(until_end) => {
                return close_and_exit(
                    auction_id,
                    &mut receiver,
                    &redis_pool,
                    &kafka_producer,
                    &state,
                    runtime.auction_type,
                    runtime.reserve_price,
                )
                .await;
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
            auction.id    = %auction_id,
            bidder.id     = %task.bid.bidder_id,
            request.id    = %task.request_id,
            kafka.partition = task.source_partition,
            kafka.offset  = task.source_offset,
            bid.amount    = task.bid.amount,
        );
        auction_observability::set_parent_from_trace_context(&bid_span, &task.trace_context);

        let processing = AssertUnwindSafe(ledger::write_bid(
            &task,
            runtime.auction_type,
            is_executed,
            runtime.current_price,
            &redis_pool,
        ))
        .catch_unwind()
        .instrument(bid_span.clone())
        .await;

        match processing {
            Ok(Ok(write)) => {
                if write == LedgerWrite::Applied {
                    if is_executed {
                        runtime.current_price = task.bid.amount;
                    }
                    // Only notify if a new event was actually written to the
                    // pending stream. Duplicate writes don't add entries, so
                    // waking the publisher would cause a spurious XREAD.
                    notify_publisher.notify_one();
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

/// Drains any tasks still sitting in the receiver with the given rejection reason.
pub(super) fn reject_queued_tasks(receiver: &mut mpsc::Receiver<AuctionTask>, reason: &str) {
    while let Ok(task) = receiver.try_recv() {
        let _ = task
            .respond_to
            .send(AuctionTaskResult::Rejected(reason.to_string()));
    }
}

/// Closes the auction in Redis/Kafka and transitions lifecycle state.
async fn close_and_exit(
    auction_id: Uuid,
    receiver: &mut mpsc::Receiver<AuctionTask>,
    redis_pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
    kafka_producer: &rdkafka::producer::FutureProducer,
    state: &CachePaddedAuctionState,
    auction_type: crate::types::AuctionType,
    reserve_price: Option<f64>,
) -> ActorExit {
    state.lifecycle.store(STATE_ENDING, Ordering::Release);
    reject_queued_tasks(receiver, "AUCTION_ENDED");
    ledger::close_auction(
        auction_id,
        auction_type,
        reserve_price,
        redis_pool,
        kafka_producer,
    )
    .await
    .unwrap_or_else(|error| panic!("auction close failed: {error}"));
    state.lifecycle.store(STATE_CLOSED, Ordering::Release);
    ActorExit::AuctionEnded
}
