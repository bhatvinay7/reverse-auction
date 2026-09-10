use redis::Client;
use std::env;

pub const AUCTION_STATE_HASH_KEY: &str = "auction:states";
pub const AUCTION_INITIALIZED_HASH_KEY: &str = "auction:initialized_hash";
pub const AUCTION_SCHEDULE_ZSET_KEY: &str = "auction:schedule_zset";
pub const AUCTION_PARTICIPANTS_PREFIX: &str = "auction:participants";
pub const AUCTION_INCOMING_BIDS_STREAM: &str = "auction:incoming_bids";
pub const AUCTION_CATALOG_VERSION_KEY: &str = "auction:catalog:version";
pub const AUCTION_CATALOG_CACHE_TTL_SECS: u64 = 60;

// ─── CRC16 Redis Cluster Hash Tag Formatted Key Functions ──────────────────────
// Surrounding auction_id with curly braces {} ensures Redis Cluster routes all keys
// belonging to the same auction_id to the exact same hash slot (CRC16 calculation).

pub fn format_node_key(auction_id: &str) -> String {
    format!("{{{}}}:node", auction_id)
}

pub fn format_auction_state_key(auction_id: &str) -> String {
    format!("{{{}}}:state", auction_id)
}

pub fn format_participants_key(auction_id: &str) -> String {
    format!("{{{}}}:participants", auction_id)
}

/// Pre-cluster key used before the shared participant-key contract was
/// introduced. Read only as a short-lived migration fallback; new writes must
/// always use `format_participants_key`.
pub fn format_legacy_participants_key(auction_id: &str) -> String {
    format!("{}:{}", AUCTION_PARTICIPANTS_PREFIX, auction_id)
}

pub fn format_zset_key(auction_id: &str) -> String {
    format!("{{{}}}:zset:low_bids", auction_id)
}

pub fn format_sync_stream(auction_id: &str) -> String {
    format!("{{{}}}:stream:sync", auction_id)
}

pub fn format_live_stream(auction_id: &str) -> String {
    format!("{{{}}}:stream:live", auction_id)
}

pub fn format_pubsub_channel(auction_id: &str) -> String {
    format!("{{{}}}:events", auction_id)
}

pub fn format_discussion_key(auction_id: &str) -> String {
    format!("{{{}}}:discussion", auction_id)
}

pub fn format_bid_request_stream(auction_id: &str) -> String {
    format!("{{{}}}:bid_request", auction_id)
}

pub fn format_auction_catalog_key(version: u64, user_id: &str) -> String {
    format!("auction:catalog:{version}:user:{user_id}")
}

pub fn get_redis_client() -> redis::RedisResult<Client> {
    dotenvy::dotenv().ok();
    let mut redis_url = env::var("REDIS_URL").unwrap_or_else(|_| {
        "redis://default:AXXGzNs7wEknlMGRlPKu3vap7J3h9zE8@redis-11356.c305.ap-south-1-1.ec2.cloud.redislabs.com:11356".to_string()
    });
    if !redis_url.contains("protocol=resp3") {
        if redis_url.contains('?') {
            redis_url.push_str("&protocol=resp3");
        } else {
            redis_url.push_str("?protocol=resp3");
        }
    }
    Client::open(redis_url)
}

pub async fn get_redis_connection() -> redis::RedisResult<redis::aio::ConnectionManager> {
    let client = get_redis_client()?;
    let mut con = redis::aio::ConnectionManager::new(client).await?;

    let _: redis::RedisResult<()> = redis::cmd("XGROUP")
        .arg("CREATE")
        .arg(AUCTION_INCOMING_BIDS_STREAM)
        .arg("global_group")
        .arg("$")
        .arg("MKSTREAM")
        .query_async(&mut con)
        .await;

    let _: redis::RedisResult<()> = redis::cmd("XGROUP")
        .arg("CREATE")
        .arg("auction:sync_queue")
        .arg("global_group")
        .arg("$")
        .arg("MKSTREAM")
        .query_async(&mut con)
        .await;

    let _: redis::RedisResult<()> = redis::cmd("CONFIG")
        .arg("SET")
        .arg("appendonly")
        .arg("no")
        .query_async(&mut con)
        .await;

    let _: redis::RedisResult<()> = redis::cmd("CONFIG")
        .arg("SET")
        .arg("tcp-keepalive")
        .arg("60")
        .query_async(&mut con)
        .await;

    let _: redis::RedisResult<()> = redis::cmd("CONFIG")
        .arg("SET")
        .arg("maxclients")
        .arg("30")
        .query_async(&mut con)
        .await;

    Ok(con)
}

pub async fn get_redis_pool()
-> Result<bb8::Pool<bb8_redis::RedisConnectionManager>, Box<dyn std::error::Error>> {
    let client = get_redis_client()?;
    let manager = bb8_redis::RedisConnectionManager::new(client.get_connection_info().clone())?;

    let pool = bb8::Pool::builder().max_size(10).build(manager).await?;

    let mut con = pool.get().await?;

    let _: redis::RedisResult<()> = redis::cmd("XGROUP")
        .arg("CREATE")
        .arg(AUCTION_INCOMING_BIDS_STREAM)
        .arg("global_group")
        .arg("$")
        .arg("MKSTREAM")
        .query_async(&mut *con)
        .await;

    let _: redis::RedisResult<()> = redis::cmd("XGROUP")
        .arg("CREATE")
        .arg("auction:sync_queue")
        .arg("global_group")
        .arg("$")
        .arg("MKSTREAM")
        .query_async(&mut *con)
        .await;

    let _: redis::RedisResult<()> = redis::cmd("CONFIG")
        .arg("SET")
        .arg("appendonly")
        .arg("no")
        .query_async(&mut *con)
        .await;

    let _: redis::RedisResult<()> = redis::cmd("CONFIG")
        .arg("SET")
        .arg("tcp-keepalive")
        .arg("60")
        .query_async(&mut *con)
        .await;

    let _: redis::RedisResult<()> = redis::cmd("CONFIG")
        .arg("SET")
        .arg("maxclients")
        .arg("30")
        .query_async(&mut *con)
        .await;

    drop(con);

    Ok(pool)
}

#[cfg(test)]
mod tests {
    #[test]
    fn auction_catalog_keys_are_versioned_and_user_scoped() {
        assert_eq!(
            super::format_auction_catalog_key(7, "user-123"),
            "auction:catalog:7:user:user-123"
        );
    }

    #[test]
    fn participant_keys_have_a_canonical_cluster_safe_form() {
        assert_eq!(
            super::format_participants_key("auction-1"),
            "{auction-1}:participants"
        );
        assert_eq!(
            super::format_legacy_participants_key("auction-1"),
            "auction:participants:auction-1"
        );
    }
}
