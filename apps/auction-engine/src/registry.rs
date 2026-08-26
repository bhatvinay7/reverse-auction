use std::{
    sync::{
        Arc,
        atomic::{AtomicU8, AtomicU64, Ordering},
    },
    time::Duration,
};

use dashmap::{DashMap, mapref::entry::Entry};
use tokio::sync::{Mutex, mpsc};
use uuid::Uuid;

use crate::{actor, types::AuctionTask};

const DEFAULT_QUEUE_CAPACITY: usize = 5_000;
pub(crate) const STATE_INITIALIZING: u8 = 0;
pub(crate) const STATE_ACTIVE: u8 = 1;
pub(crate) const STATE_ENDING: u8 = 2;
pub(crate) const STATE_CLOSED: u8 = 3;

#[repr(align(64))]
pub struct CachePaddedAuctionActor {
    pub generation: u64,
    pub sender: mpsc::Sender<AuctionTask>,
}

#[repr(align(64))]
pub struct CachePaddedAuctionState {
    pub(crate) lifecycle: AtomicU8,
}

#[derive(Clone)]
pub struct AuctionRegistry {
    pub(crate) actors: Arc<DashMap<Uuid, Arc<CachePaddedAuctionActor>>>,
    pub(crate) states: Arc<DashMap<Uuid, Arc<CachePaddedAuctionState>>>,
    pub(crate) redis_pool: bb8::Pool<bb8_redis::RedisConnectionManager>,
    pub(crate) kafka_producer: rdkafka::producer::FutureProducer,
    generation: Arc<AtomicU64>,
    queue_capacity: usize,
}

impl AuctionRegistry {
    pub fn new(
        redis_pool: bb8::Pool<bb8_redis::RedisConnectionManager>,
        kafka_producer: rdkafka::producer::FutureProducer,
    ) -> Self {
        let queue_capacity = std::env::var("AUCTION_ACTOR_QUEUE_CAPACITY")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(DEFAULT_QUEUE_CAPACITY)
            .max(1);
        Self {
            actors: Arc::new(DashMap::new()),
            states: Arc::new(DashMap::new()),
            redis_pool,
            kafka_producer,
            generation: Arc::new(AtomicU64::new(1)),
            queue_capacity,
        }
    }

    pub fn get_or_create(self: &Arc<Self>, auction_id: Uuid) -> Arc<CachePaddedAuctionActor> {
        loop {
            match self.actors.entry(auction_id) {
                Entry::Occupied(entry) if !entry.get().sender.is_closed() => {
                    return entry.get().clone();
                }
                Entry::Occupied(entry) => {
                    entry.remove();
                }
                Entry::Vacant(entry) => {
                    let generation = self.generation.fetch_add(1, Ordering::Relaxed);
                    let (sender, receiver) = mpsc::channel(self.queue_capacity);
                    let handle = Arc::new(CachePaddedAuctionActor { generation, sender });
                    let state = self
                        .states
                        .entry(auction_id)
                        .or_insert_with(|| {
                            Arc::new(CachePaddedAuctionState {
                                lifecycle: AtomicU8::new(STATE_INITIALIZING),
                            })
                        })
                        .clone();
                    entry.insert(handle.clone());
                    actor::start_supervisor(
                        self.clone(),
                        auction_id,
                        generation,
                        state,
                        Arc::new(Mutex::new(receiver)),
                    );
                    return handle;
                }
            }
        }
    }

    pub(crate) fn remove_if_generation(&self, auction_id: Uuid, generation: u64) {
        if self
            .actors
            .remove_if(&auction_id, |_, actor| actor.generation == generation)
            .is_some()
        {
            self.states.remove(&auction_id);
        }
    }

    pub(crate) fn restart_delay(restarts: u32) -> Duration {
        Duration::from_millis((100_u64 << restarts.min(5)).min(3_000))
    }

    #[cfg(test)]
    pub fn actor_count(&self) -> usize {
        self.actors.len()
    }
}

#[cfg(test)]
mod tests {
    use super::{CachePaddedAuctionActor, CachePaddedAuctionState};

    #[test]
    fn actor_handle_uses_cache_line_alignment() {
        assert_eq!(std::mem::align_of::<CachePaddedAuctionActor>(), 64);
        assert_eq!(std::mem::align_of::<CachePaddedAuctionState>(), 64);
    }
}
