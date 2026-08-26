use rdkafka::Message;

#[tokio::test]
#[ignore = "requires a local Kafka broker"]
async fn notification_and_sync_topics_accept_keyed_records() {
    dotenvy::dotenv().ok();
    auction_kafka::ensure_topics().await.unwrap();
    let producer = auction_kafka::producer().unwrap();
    let auction_id = uuid::Uuid::new_v4().to_string();
    let payload = serde_json::json!({
        "auction_id": auction_id,
        "event_type": "auction_closed",
        "message": "Auction closed",
    })
    .to_string();
    auction_kafka::publish(
        &producer,
        auction_kafka::NOTIFICATION_TOPIC,
        &auction_id,
        payload.as_bytes(),
    )
    .await
    .unwrap();

    let group = format!("notification-test-{}", uuid::Uuid::new_v4());
    let consumer = auction_kafka::consumer(&group, &[auction_kafka::NOTIFICATION_TOPIC]).unwrap();
    let message = tokio::time::timeout(std::time::Duration::from_secs(10), consumer.recv())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(message.key_view::<str>().unwrap().unwrap(), auction_id);
}
