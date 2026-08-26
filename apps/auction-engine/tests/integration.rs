use auction_engine::types::{AuctionType, is_better_bid};

#[test]
fn forward_and_reverse_auctions_apply_opposite_ordering_rules() {
    assert!(is_better_bid(AuctionType::Forward, 100.0, 105.0, 5.0));
    assert!(!is_better_bid(AuctionType::Forward, 100.0, 95.0, 5.0));
    assert!(is_better_bid(AuctionType::Reverse, 100.0, 95.0, 5.0));
    assert!(!is_better_bid(AuctionType::Reverse, 100.0, 105.0, 5.0));
}

#[tokio::test]
#[ignore = "requires a local Kafka broker"]
async fn kafka_bid_topic_is_partitioned_for_actor_consumers() {
    dotenvy::dotenv().ok();
    auction_kafka::ensure_topics().await.unwrap();
    let consumer = auction_kafka::consumer(
        &format!("engine-test-{}", uuid::Uuid::new_v4()),
        &[auction_kafka::BID_TOPIC],
    );
    assert!(consumer.is_ok());
}
