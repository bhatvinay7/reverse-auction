use redis::AsyncCommands;
use uuid::Uuid;

#[tokio::test]
async fn test_ws_server_redis_pubsub_handling() {
    dotenvy::dotenv().ok();

    let redis_url = std::env::var("REDIS_URL").expect("REDIS_URL must be set in .env");
    let client = redis::Client::open(redis_url).expect("Failed to create redis client");
    let mut con = client
        .get_multiplexed_async_connection()
        .await
        .expect("Failed to connect to redis");

    let dummy_auction_id = Uuid::new_v4();
    let channel_name = format!("auction:updates:{}", dummy_auction_id);

    let dummy_event = serde_json::json!({
        "event_type": "NEW_BID",
        "amount": 150.00,
        "bidder_id": Uuid::new_v4().to_string(),
        "timestamp": chrono::Utc::now().to_rfc3339()
    });

    let payload = serde_json::to_string(&dummy_event).unwrap();

    // Verify we can publish to the Redis pubsub channel which the WS server listens to
    let _: () = con
        .publish(&channel_name, payload)
        .await
        .expect("Failed to publish to redis");
}
