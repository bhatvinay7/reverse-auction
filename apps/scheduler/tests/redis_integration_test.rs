use std::env;
use redis::AsyncCommands;
use uuid::Uuid;

#[tokio::test]
async fn test_scheduler_job_state_redis_sync() {
    // 1. Load the environment variables from .env
    dotenvy::dotenv().ok();
    
    // 2. Use the URL from .env (fallback for safety, though user expects from .env)
    let redis_url = env::var("REDIS_URL").expect("REDIS_URL must be set in .env");
    let client = redis::Client::open(redis_url).expect("Failed to create redis client");
    let mut con = client.get_multiplexed_async_connection().await.expect("Failed to connect to redis");

    // 3. Test case: simulate scheduler pushing a job state to Redis
    let job_id = Uuid::parse_str("123e4567-e89b-12d3-a456-426614174000").unwrap().to_string();
    let test_key = format!("test:scheduler:job:{}", job_id);
    let job_payload = r#"{"status": "Scheduled", "retry": 0}"#;

    // Set the state
    let _: () = con.set(&test_key, job_payload).await.expect("Failed to set job state in redis");
    
    // Retrieve and verify the state
    let retrieved: String = con.get(&test_key).await.expect("Failed to get job state from redis");
    assert_eq!(retrieved, job_payload, "Retrieved job payload does not match expected");
    
    // 4. Cleanup
    let _: () = con.del(&test_key).await.expect("Failed to clean up test key");
}
