use rdkafka::{
    Message, Offset, TopicPartitionList,
    consumer::{CommitMode, Consumer, StreamConsumer},
    producer::FutureProducer,
};

pub async fn wait_for_topics() {
    let mut delay = 1_u64;
    loop {
        match auction_kafka::ensure_topics().await {
            Ok(()) => return,
            Err(error) => {
                auction_observability::report_error(
                    "notification-worker",
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

pub fn commit<M: Message>(consumer: &StreamConsumer, message: &M) {
    let mut offsets = TopicPartitionList::new();
    if let Err(error) = offsets.add_partition_offset(
        message.topic(),
        message.partition(),
        Offset::Offset(message.offset() + 1),
    ) {
        auction_observability::report_error(
            "notification-worker",
            "offset_commit_build",
            error.to_string(),
            serde_json::json!({
                "topic": message.topic(),
                "partition": message.partition(),
                "offset": message.offset(),
            }),
        );
        return;
    }
    if let Err(error) = consumer.commit(&offsets, CommitMode::Async) {
        auction_observability::report_error(
            "notification-worker",
            "offset_commit",
            error.to_string(),
            serde_json::json!({
                "topic": message.topic(),
                "partition": message.partition(),
                "offset": message.offset(),
            }),
        );
    }
}

pub async fn publish_dlq<M: Message>(producer: &FutureProducer, message: &M, reason: &str) -> bool {
    let key = message
        .key_view::<str>()
        .and_then(Result::ok)
        .unwrap_or("unknown");
    let payload = serde_json::json!({
        "source_topic": message.topic(),
        "source_partition": message.partition(),
        "source_offset": message.offset(),
        "reason": reason,
        "payload": String::from_utf8_lossy(message.payload().unwrap_or_default()),
    })
    .to_string();
    match auction_kafka::publish(producer, auction_kafka::DLQ_TOPIC, key, payload.as_bytes()).await
    {
        Ok(_) => true,
        Err(error) => {
            auction_observability::report_error(
                "notification-worker",
                "dlq_publish",
                error,
                serde_json::json!({
                    "source_topic": message.topic(),
                    "partition": message.partition(),
                    "offset": message.offset(),
                }),
            );
            false
        }
    }
}
