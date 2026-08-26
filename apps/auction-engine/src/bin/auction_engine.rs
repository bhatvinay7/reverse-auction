use std::sync::Arc;

use auction_engine::registry::AuctionRegistry;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let _telemetry = auction_observability::init_telemetry("auction-engine")?;
    if let Err(error) = run().await {
        auction_observability::report_error(
            "auction-engine",
            "service_exit",
            error.to_string(),
            serde_json::json!({"fatal": true}),
        );
        return Err(error);
    }
    Ok(())
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    wait_for_topics().await;
    let producer = auction_kafka::producer()
        .map_err(|error| format!("failed to create Kafka producer: {error}"))?;
    let consumer = Arc::new(
        auction_kafka::consumer(auction_kafka::ENGINE_GROUP, &[auction_kafka::BID_TOPIC])
            .map_err(|error| format!("failed to create Kafka consumer: {error}"))?,
    );
    let redis_pool = auction_redis::get_redis_pool()
        .await
        .map_err(|error| format!("failed to create Redis pool: {error}"))?;
    let registry = Arc::new(AuctionRegistry::new(redis_pool, producer.clone()));

    println!(
        "[auction-engine] consuming Kafka topic {} as group {}",
        auction_kafka::BID_TOPIC,
        auction_kafka::ENGINE_GROUP
    );
    auction_engine::consumer::consume(consumer, registry, producer).await
}

async fn wait_for_topics() {
    let mut delay = 1_u64;
    loop {
        match auction_kafka::ensure_topics().await {
            Ok(()) => return,
            Err(error) => {
                auction_observability::report_error(
                    "auction-engine",
                    "topic_setup",
                    error,
                    serde_json::json!({"retry_in_seconds": delay}),
                );
                tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
                delay = (delay * 2).min(60);
            }
        }
    }
}
