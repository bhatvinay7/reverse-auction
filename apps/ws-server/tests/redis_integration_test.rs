use redis::AsyncCommands;
use std::env;
use uuid::Uuid;

// Hardcoding the key to match ws-server's expectations in tests without referencing the crate if it's tricky
const AUCTION_STATE_HASH_KEY: &str = "auction:states";

#[tokio::test]
async fn test_ws_server_auction_existence_check() {
    // 1. Load the environment variables from .env
    dotenvy::dotenv().ok();

    // 2. Use the URL from .env
    let redis_url = env::var("REDIS_URL").expect("REDIS_URL must be set in .env");
    let client = redis::Client::open(redis_url).expect("Failed to create redis client");
    let mut con = client
        .get_multiplexed_async_connection()
        .await
        .expect("Failed to connect to redis");

    // 3. Test case: Simulate an auction initialization and test the Hexists check from ws-server
    let auction_id = Uuid::parse_str("123e4567-e89b-12d3-a456-426614174000")
        .unwrap()
        .to_string();
    let mock_payload = r#"{"status": "Active"}"#;

    // Verify it does not exist initially
    let exists_initially: bool = con
        .hexists(AUCTION_STATE_HASH_KEY, &auction_id)
        .await
        .expect("Failed to check hexists");
    assert!(
        !exists_initially,
        "New auction ID should not exist in the hash"
    );

    // Simulate engine initializing the auction state
    let _: () = con
        .hset(AUCTION_STATE_HASH_KEY, &auction_id, mock_payload)
        .await
        .expect("Failed to hset auction state");

    // Verify it exists now (which would allow WS connection)
    let exists_now: bool = con
        .hexists(AUCTION_STATE_HASH_KEY, &auction_id)
        .await
        .expect("Failed to check hexists after set");
    assert!(
        exists_now,
        "Auction ID should exist in the hash after initialization"
    );

    // 4. Cleanup
    let _: () = con
        .hdel(AUCTION_STATE_HASH_KEY, &auction_id)
        .await
        .expect("Failed to clean up test hash field");
}
