use std::{
    sync::Arc,
    time::{Duration, Instant},
};

use bb8::Pool;
use bb8_redis::RedisConnectionManager;
use dashmap::DashMap;

use crate::{
    auth::AuthConfig, circuit_breaker::CircuitBreaker, internal_identity::InternalSigner,
    throttle::RateLimiter,
};

pub type RedisPool = Pool<RedisConnectionManager>;

#[derive(Clone)]
pub struct GatewayState {
    pub redis_pool: RedisPool,
    pub http_client: reqwest::Client,
    pub http_server_url: Arc<str>,
    pub socket_server_url: Arc<str>,
    pub search_server_url: Arc<str>,
    pub auth: Arc<AuthConfig>,
    pub signer: Arc<InternalSigner>,
    pub limiter: RateLimiter,
    pub http_breaker: CircuitBreaker,
    pub socket_breaker: CircuitBreaker,
    pub search_breaker: CircuitBreaker,
    pub socket_tickets: Arc<DashMap<String, SocketTicket>>,
}

#[derive(Clone)]
pub struct SocketTicket {
    pub user_id: String,
    pub role: String,
    pub expires_at: Instant,
}

impl GatewayState {
    pub async fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        let redis_pool = auction_redis::get_redis_pool().await?;
        let timeout = env_u64("DOWNSTREAM_TIMEOUT_SECS", 20);
        let http_client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(timeout))
            .build()?;

        let threshold = env_u64("CIRCUIT_FAILURE_THRESHOLD", 5) as u32;
        let open_for = Duration::from_secs(env_u64("CIRCUIT_OPEN_SECS", 30));
        Ok(Self {
            limiter: RateLimiter::new(redis_pool.clone()),
            http_breaker: CircuitBreaker::new("http-server", threshold, open_for),
            socket_breaker: CircuitBreaker::new("ws-server", threshold, open_for),
            search_breaker: CircuitBreaker::new("search-server", threshold, open_for),
            redis_pool,
            http_client,
            http_server_url: env_string("HTTP_SERVER_URL", "http://127.0.0.1:8082").into(),
            socket_server_url: env_string("WS_SERVER_URL", "http://127.0.0.1:8081").into(),
            search_server_url: env_string("SEARCH_SERVER_ADDR", "http://127.0.0.1:8081").into(),
            auth: Arc::new(AuthConfig::from_env()?),
            signer: Arc::new(InternalSigner::from_env()?),
            socket_tickets: Arc::new(DashMap::new()),
        })
    }
}

fn env_string(name: &str, default: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| default.into())
}

fn env_u64(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}
