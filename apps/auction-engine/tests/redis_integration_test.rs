use std::env;
use redis::AsyncCommands;
use uuid::Uuid;
use serde_json::json;
use lapin::{options::*, types::FieldTable, BasicProperties};
use rabbitmq::get_rabbitmq_connection;

#[tokio::test]
async fn test_auction_engine_bid_processing_redis() {
    // 1. Load the environment variables from .env
    dotenvy::dotenv().ok();
    
    // 2. Use the URL from .env
    let redis_url = env::var("REDIS_URL").expect("REDIS_URL must be set in .env");
    let client = redis::Client::open(redis_url).expect("Failed to create redis client");
    let mut con = client.get_multiplexed_async_connection().await.expect("Failed to connect to redis");

    // 3. Test case: simulate processing a bid in the engine and pushing to ledger (ZSET + PubSub)
    let auction_id = Uuid::parse_str("123e4567-e89b-12d3-a456-426614174000").unwrap();
    let zset_key = format!("test:auction:zset:low_bids:{}", auction_id);
    let bid_amount = 450;
    
    let payload = json!({
        "bid": {
            "auction_id": auction_id,
            "bidder_id": "user_42",
            "amount": bid_amount,
            "timestamp": 1234567890
        },
        "is_executed": true
    });
    let payload_str = payload.to_string();

    // Add bid to sorted set
    let _: () = con.zadd(&zset_key, &payload_str, bid_amount as f64).await.expect("Failed to zadd bid");

    // Retrieve from sorted set to verify it exists and is ordered correctly
    let top_bids: Vec<String> = con.zrange(&zset_key, 0, 0).await.expect("Failed to zrange bids");
    assert_eq!(top_bids.len(), 1);
    assert_eq!(top_bids[0], payload_str);
    
    // 4. Cleanup
    let _: () = con.del(&zset_key).await.expect("Failed to clean up test zset");
}

#[tokio::test]
async fn test_auction_engine_rabbitmq_queue_init() {
    dotenvy::dotenv().ok();
    
    // Connect to RMQ
    let rmq_conn = get_rabbitmq_connection().await.expect("Failed to connect to RabbitMQ");
    let channel = rmq_conn.create_channel().await.expect("Failed to create channel");

    let auction_id = Uuid::new_v4().to_string();
    let bid_queue = rabbitmq::auction_bid_queue(&auction_id);
    
    // Declare the per-auction queue with DLQ bindings just like the engine does
    let mut dlq_args = FieldTable::default();
    dlq_args.insert(
        "x-dead-letter-exchange".into(),
        lapin::types::AMQPValue::LongString("".into()),
    );
    dlq_args.insert(
        "x-dead-letter-routing-key".into(),
        lapin::types::AMQPValue::LongString(rabbitmq::AUCTION_BIDS_DLQ.into()),
    );
    let mut per_q_opts = QueueDeclareOptions::default();
    per_q_opts.durable = true;
    
    channel.queue_declare(bid_queue.as_str().into(), per_q_opts, dlq_args).await.expect("Failed to declare queue");
    
    // Cleanup
    channel.queue_delete(bid_queue.as_str().into(), QueueDeleteOptions::default()).await.unwrap();
}
