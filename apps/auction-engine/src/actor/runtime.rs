use redis::AsyncCommands;
use uuid::Uuid;

use crate::types::{AuctionRuntime, AuctionType};

/// Hydrates [`AuctionRuntime`] for the given auction from Redis.
///
/// Tries the per-auction state key first (`{auction_id}:state`), then falls
/// back to the shared hash (`auction:states`). If no state is found the actor
/// uses safe defaults (3-minute window, reverse auction, `f64::MAX` starting
/// price) and will accept the first bid that arrives.
pub(super) async fn load_runtime(
    auction_id: Uuid,
    pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
) -> AuctionRuntime {
    let id = auction_id.to_string();
    let mut connection = pool
        .get()
        .await
        .unwrap_or_else(|error| panic!("Redis pool unavailable while restoring actor: {error}"));

    // Try the per-auction state key, then fall back to the shared hash.
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
                .and_then(|v| v.as_f64())
            {
                current_price = price;
            }
            if let Some(value) = auction_record
                .get("auction_end_time")
                .and_then(|v| v.as_str())
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
                    .filter(|v| v.get("auction_type").is_some())
            })
            .or(auction_record);

        if let Some(config) = config {
            auction_type = match config
                .get("auction_type")
                .and_then(|v| v.as_str())
                .unwrap_or("REVERSE")
                .to_ascii_uppercase()
                .as_str()
            {
                "FORWARD" => AuctionType::Forward,
                _ => AuctionType::Reverse,
            };
            minimum_bid_step = config
                .get("minimum_bid_step")
                .and_then(|v| v.as_f64())
                .filter(|v| v.is_finite() && *v > 0.0)
                .unwrap_or(1.0);
            reserve_price = config
                .get("reserve_price")
                .and_then(|v| v.as_f64())
                .filter(|v| v.is_finite() && *v >= 0.0);
        }
    }

    // Seed current_price from the best existing bid so the actor resumes
    // correctly after a restart without re-reading all bids.
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
        .and_then(|v| serde_json::from_str::<serde_json::Value>(v).ok())
        .and_then(|v| v.get("bid")?.get("amount")?.as_f64())
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
