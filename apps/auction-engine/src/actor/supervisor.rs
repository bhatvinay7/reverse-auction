use std::sync::Arc;

use futures_util::FutureExt;
use std::panic::AssertUnwindSafe;
use tokio::sync::{Mutex, mpsc};
use uuid::Uuid;

use crate::{
    registry::{AuctionRegistry, CachePaddedAuctionState},
    types::{ActorExit, AuctionTask},
};

use super::{loop_::run_actor_loop, publisher::run_kafka_publisher_loop};

/// Starts the outer supervision loop for one auction actor.
///
/// The supervisor owns the restart policy. On each iteration it spawns two
/// linked async tasks under a single `tokio::select!`:
///
/// - **actor loop** – serially processes incoming [`AuctionTask`]s.
/// - **publisher loop** – drains `{auction_id}:pending_kafka_events` and
///   publishes to Kafka independently of the actor.
///
/// If either task panics or exits unexpectedly the supervisor aborts the other
/// and restarts both together, preventing silent half-dead actors.
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
            let notify_publisher = Arc::new(tokio::sync::Notify::new());

            let supervisor_handle = tokio::spawn(async move {
                let notify_actor = notify_publisher.clone();
                let actor_redis = registry_ref.redis_pool.clone();
                let actor_kafka = registry_ref.kafka_producer.clone();

                let actor_future = AssertUnwindSafe(run_actor_loop(
                    auction_id,
                    receiver_ref,
                    actor_redis,
                    actor_kafka,
                    state_ref,
                    notify_actor,
                ))
                .catch_unwind();

                let publisher_redis = registry_ref.redis_pool.clone();
                let publisher_kafka = registry_ref.kafka_producer.clone();

                let publisher_future = AssertUnwindSafe(run_kafka_publisher_loop(
                    auction_id,
                    publisher_redis,
                    publisher_kafka,
                    notify_publisher,
                ))
                .catch_unwind();

                tokio::select! {
                    res = actor_future => match res {
                        Ok(exit) => Ok(exit),
                        Err(e)   => Err(e),
                    },
                    res = publisher_future => match res {
                        Ok(_)  => Ok(ActorExit::ChannelClosed),
                        Err(e) => Err(e),
                    }
                }
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
