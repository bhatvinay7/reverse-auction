use std::{
    sync::Arc,
    time::{Duration, Instant},
};

use dashmap::DashMap;

use crate::{error::GatewayError, state::RedisPool};

#[derive(Clone)]
pub struct RateLimiter {
    pool: RedisPool,
    fallback: Arc<DashMap<String, CacheLine<LocalWindow>>>,
}

#[repr(align(64))]
struct CacheLine<T>(T);

struct LocalWindow {
    count: u64,
    resets_at: Instant,
}

impl RateLimiter {
    pub fn new(pool: RedisPool) -> Self {
        Self {
            pool,
            fallback: Arc::new(DashMap::new()),
        }
    }

    pub async fn check(&self, key: &str, limit: u64, window: Duration) -> Result<(), GatewayError> {
        let redis_key = format!("gateway:rate:{key}");
        if let Ok(mut connection) = self.pool.get().await {
            let script = redis::Script::new(
                "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
            );
            let count: redis::RedisResult<u64> = script
                .key(redis_key)
                .arg(window.as_secs().max(1))
                .invoke_async(&mut *connection)
                .await;
            if let Ok(count) = count {
                return decision(count, limit, window);
            }
        }

        let now = Instant::now();
        let count = {
            let mut entry = self.fallback.entry(key.to_owned()).or_insert_with(|| {
                CacheLine(LocalWindow {
                    count: 0,
                    resets_at: now + window,
                })
            });
            if now >= entry.0.resets_at {
                entry.0.count = 0;
                entry.0.resets_at = now + window;
            }
            entry.0.count += 1;
            entry.0.count
        };
        decision(count, limit, window)
    }
}

fn decision(count: u64, limit: u64, window: Duration) -> Result<(), GatewayError> {
    if count <= limit {
        Ok(())
    } else {
        Err(GatewayError::new(
            axum::http::StatusCode::TOO_MANY_REQUESTS,
            "RATE_LIMITED",
            "Too many requests",
        )
        .with_retry_after(window.as_secs().max(1)))
    }
}
