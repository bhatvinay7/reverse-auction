use std::{collections::HashMap, sync::Arc, time::Duration};

use futures_util::StreamExt;
use rdkafka::{
    Message, Offset, TopicPartitionList,
    consumer::{CommitMode, Consumer, StreamConsumer},
    message::OwnedMessage,
};
use serde::Deserialize;
use tokio::sync::{mpsc, oneshot};

use crate::{
    registry::AuctionRegistry,
    types::{AuctionTask, AuctionTaskResult, BidRequest},
};

#[derive(Deserialize)]
struct BidEnvelope {
    request_id: String,
    #[serde(default)]
    trace_context: HashMap<String, String>,
    #[serde(flatten)]
    bid: BidRequest,
}

/// Dispatch each Kafka partition to one sequential worker. Kafka guarantees
/// ordering only inside a partition; serial workers preserve that ordering all
/// the way through the per-auction actor and offset commit.
pub async fn consume(
    consumer: Arc<StreamConsumer>,
    registry: Arc<AuctionRegistry>,
    producer: rdkafka::producer::FutureProducer,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut stream = consumer.stream();
    let mut workers: HashMap<i32, mpsc::Sender<OwnedMessage>> = HashMap::new();

    let (retry_tx, mut retry_rx) = mpsc::channel::<(String, i32, i64)>(10_000);
    let consumer_ref = consumer.clone();
    tokio::spawn(async move {
        while let Some((topic, partition, offset)) = retry_rx.recv().await {
            let mut attempts = 0;
            loop {
                let mut offsets = TopicPartitionList::new();
                if offsets.add_partition_offset(&topic, partition, Offset::Offset(offset)).is_err() {
                    break;
                }
                
                match consumer_ref.commit(&offsets, CommitMode::Async) {
                    Ok(_) => break,
                    Err(error) => {
                        attempts += 1;
                        let delay = Duration::from_millis((100_u64 << attempts.min(6)).min(5_000));
                        auction_observability::report_error(
                            "auction-engine",
                            "offset_commit_retry",
                            error.to_string(),
                            serde_json::json!({
                                "partition": partition,
                                "offset": offset,
                                "attempt": attempts,
                            }),
                        );
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }
    });

    while let Some(result) = stream.next().await {
        let message = match result {
            Ok(message) => message.detach(),
            Err(error) => {
                auction_observability::report_error(
                    "auction-engine",
                    "kafka_receive",
                    error.to_string(),
                    serde_json::json!({}),
                );
                continue;
            }
        };
        let partition = message.partition();
        let sender = workers.entry(partition).or_insert_with(|| {
            let (sender, receiver) = mpsc::channel(partition_queue_capacity());
            tokio::spawn(run_partition_worker(
                partition,
                receiver,
                consumer.clone(),
                registry.clone(),
                producer.clone(),
                retry_tx.clone(),
            ));
            sender
        });
        if let Err(error) = sender.send(message).await {
            return Err(format!("Kafka partition worker {partition} stopped: {error}").into());
        }
    }
    Ok(())
}

async fn run_partition_worker(
    partition: i32,
    mut receiver: mpsc::Receiver<OwnedMessage>,
    consumer: Arc<StreamConsumer>,
    registry: Arc<AuctionRegistry>,
    producer: rdkafka::producer::FutureProducer,
    retry_tx: mpsc::Sender<(String, i32, i64)>,
) {
    while let Some(message) = receiver.recv().await {
        let payload = message.payload().unwrap_or_default();
        let envelope = match serde_json::from_slice::<BidEnvelope>(payload) {
            Ok(envelope) if envelope.bid.amount.is_finite() && envelope.bid.amount > 0.0 => {
                envelope
            }
            Ok(_) => {
                dead_letter_until_stored(&producer, &message, "INVALID_BID_AMOUNT").await;
                commit(&consumer, &message, &retry_tx);
                continue;
            }
            Err(error) => {
                dead_letter_until_stored(&producer, &message, &format!("MALFORMED_BID:{error}"))
                    .await;
                commit(&consumer, &message, &retry_tx);
                continue;
            }
        };

        let mut attempts = 0_u32;
        loop {
            attempts = attempts.saturating_add(1);
            let actor = registry.get_or_create(envelope.bid.auction_id);
            let (respond_to, response) = oneshot::channel();
            let task = AuctionTask {
                request_id: envelope.request_id.clone(),
                bid: envelope.bid.clone(),
                source_topic: message.topic().to_string(),
                source_partition: message.partition(),
                source_offset: message.offset(),
                trace_context: envelope.trace_context.clone(),
                respond_to,
            };

            let result = match actor.sender.send(task).await {
                Ok(()) => response.await.unwrap_or_else(|_| {
                    AuctionTaskResult::Retryable("actor restarted before reply".to_string())
                }),
                Err(_) => AuctionTaskResult::Retryable("actor inbox closed".to_string()),
            };
            match result {
                AuctionTaskResult::Committed => {
                    commit(&consumer, &message, &retry_tx);
                    break;
                }
                AuctionTaskResult::Rejected(reason) => {
                    dead_letter_until_stored(&producer, &message, &reason).await;
                    commit(&consumer, &message, &retry_tx);
                    break;
                }
                AuctionTaskResult::Retryable(error) => {
                    let delay = Duration::from_millis((100_u64 << attempts.min(6)).min(5_000));
                    auction_observability::report_error(
                        "auction-engine",
                        "bid_retry",
                        error,
                        serde_json::json!({
                            "partition": partition,
                            "offset": message.offset(),
                            "attempt": attempts,
                        }),
                    );
                    tokio::time::sleep(delay).await;
                }
            }
        }
    }
}

fn commit(
    consumer: &StreamConsumer,
    message: &OwnedMessage,
    retry_tx: &mpsc::Sender<(String, i32, i64)>,
) {
    let mut offsets = TopicPartitionList::new();
    let topic = message.topic().to_string();
    let partition = message.partition();
    let offset = message.offset() + 1;
    if let Err(error) = offsets.add_partition_offset(
        &topic,
        partition,
        Offset::Offset(offset),
    ) {
        auction_observability::report_error(
            "auction-engine",
            "offset_commit_build",
            error.to_string(),
            serde_json::json!({
                "partition": partition,
                "offset": offset,
            }),
        );
        return;
    }
    if let Err(error) = consumer.commit(&offsets, CommitMode::Async) {
        auction_observability::report_error(
            "auction-engine",
            "offset_commit_enqueued_for_retry",
            error.to_string(),
            serde_json::json!({
                "partition": partition,
                "offset": offset,
            }),
        );
        let _ = retry_tx.try_send((topic, partition, offset));
    }
}

async fn dead_letter(
    producer: &rdkafka::producer::FutureProducer,
    message: &OwnedMessage,
    reason: &str,
) -> bool {
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
    if let Err(error) =
        auction_kafka::publish(producer, auction_kafka::DLQ_TOPIC, key, payload.as_bytes()).await
    {
        auction_observability::report_error(
            "auction-engine",
            "dlq_publish",
            error,
            serde_json::json!({
                "partition": message.partition(),
                "offset": message.offset(),
            }),
        );
        return false;
    }
    true
}

async fn dead_letter_until_stored(
    producer: &rdkafka::producer::FutureProducer,
    message: &OwnedMessage,
    reason: &str,
) {
    let mut delay = 1_u64;
    while !dead_letter(producer, message, reason).await {
        tokio::time::sleep(Duration::from_secs(delay)).await;
        delay = (delay * 2).min(30);
    }
}

fn partition_queue_capacity() -> usize {
    std::env::var("AUCTION_KAFKA_PARTITION_QUEUE_CAPACITY")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(1_000)
        .max(1)
}
