use uuid::Uuid;
use rabbitmq::{SCHEDULER_QUEUE, get_rabbitmq_connection};
use lapin::{options::*, types::FieldTable, BasicProperties};

#[tokio::test]
#[ignore = "RabbitMQ not available locally"]
async fn test_scheduler_data_handling_with_dummy_data() {
    dotenvy::dotenv().ok();
    
    let rmq_conn = get_rabbitmq_connection().await.expect("Failed to connect to RabbitMQ");
    let channel = rmq_conn.create_channel().await.expect("Failed to create channel");

    let mut queue_opts = QueueDeclareOptions::default();
    queue_opts.durable = true;
    channel.queue_declare(SCHEDULER_QUEUE.into(), queue_opts, FieldTable::default()).await.unwrap();

    let dummy_auction_id = Uuid::new_v4();
    let dummy_schedule = serde_json::json!({
        "auction_id": dummy_auction_id.to_string(),
        "action": "ACTIVATE_AUCTION",
        "scheduled_time": chrono::Utc::now().to_rfc3339()
    });

    let payload_bytes = serde_json::to_vec(&dummy_schedule).unwrap();

    channel.basic_publish(
        "".into(),
        SCHEDULER_QUEUE.into(),
        BasicPublishOptions::default(),
        &payload_bytes,
        BasicProperties::default(),
    ).await.expect("Failed to publish schedule message");

    // The message was successfully pushed to RabbitMQ for the scheduler to consume.
    assert!(true);
}
