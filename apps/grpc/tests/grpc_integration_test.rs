use rdkafka::{Message, consumer::Consumer};

#[tokio::test]
#[ignore = "requires a local Kafka broker"]
async fn publishes_bid_with_auction_id_as_kafka_key() {
    dotenvy::dotenv().ok();
    auction_kafka::ensure_topics().await.unwrap();
    let producer = auction_kafka::producer().unwrap();
    let auction_id = uuid::Uuid::new_v4().to_string();
    let request_id = uuid::Uuid::new_v4().to_string();
    let payload = serde_json::json!({
        "request_id": request_id,
        "auction_id": auction_id,
        "bidder_id": uuid::Uuid::new_v4().to_string(),
        "amount": 500.0,
        "timestamp": chrono::Utc::now().timestamp_millis(),
    });
    auction_kafka::publish(
        &producer,
        auction_kafka::BID_TOPIC,
        &auction_id,
        payload.to_string().as_bytes(),
    )
    .await
    .unwrap();

    let group = format!("grpc-test-{}", uuid::Uuid::new_v4());
    let consumer = auction_kafka::consumer(&group, &[auction_kafka::BID_TOPIC]).unwrap();
    let message = tokio::time::timeout(std::time::Duration::from_secs(10), consumer.recv())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(message.key_view::<str>().unwrap().unwrap(), auction_id);
    consumer.unsubscribe();
}
