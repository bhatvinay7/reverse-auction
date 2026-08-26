use redis::AsyncCommands;
use uuid::Uuid;

use crate::{auth::Identity, error::GatewayError, state::RedisPool};

pub async fn require_participant(
    pool: &RedisPool,
    auction_id: Uuid,
    identity: &Identity,
) -> Result<(), GatewayError> {
    if matches!(identity.role.as_str(), "ADMIN" | "CUSTOMER") {
        return Ok(());
    }
    let mut connection = pool.get().await.map_err(|_| {
        GatewayError::new(
            axum::http::StatusCode::SERVICE_UNAVAILABLE,
            "ACCESS_STORE_UNAVAILABLE",
            "Auction access validation is temporarily unavailable",
        )
    })?;
    let offset = (identity.user_id.as_u128() % (1 << 31)) as usize;
    let key = format!("auction:participants:{auction_id}");
    let bit: i64 = connection.getbit(key, offset).await.map_err(|_| {
        GatewayError::new(
            axum::http::StatusCode::SERVICE_UNAVAILABLE,
            "ACCESS_STORE_UNAVAILABLE",
            "Auction access validation is temporarily unavailable",
        )
    })?;
    if bit == 1 {
        Ok(())
    } else {
        Err(GatewayError::new(
            axum::http::StatusCode::FORBIDDEN,
            "AUCTION_ACCESS_DENIED",
            "Join this auction before opening a live connection",
        ))
    }
}
