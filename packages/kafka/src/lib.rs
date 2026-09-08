use std::{env, path::Path, time::Duration};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use rdkafka::{
    ClientConfig,
    admin::{AdminClient, AdminOptions, NewTopic, TopicReplication},
    client::DefaultClientContext,
    consumer::{Consumer, StreamConsumer},
    error::KafkaError,
    producer::{FutureProducer, FutureRecord},
    util::Timeout,
};
pub const BID_TOPIC: &str = "auction-bids";
pub const BID_DECISION_TOPIC: &str = "auction-bid-decisions";
pub const NOTIFICATION_TOPIC: &str = "auction-notifications";
pub const SYNC_TOPIC: &str = "auction-sync";
pub const DLQ_TOPIC: &str = "auction-dlq";
pub const CDC_AUCTIONS_TOPIC: &str = "cdc-auctions";
pub const CDC_AUCTION_LISTINGS_TOPIC: &str = "cdc-auction-listings";

pub const ENGINE_GROUP: &str = "auction-engine";
pub const BID_AUDIT_GROUP: &str = "auction-bid-audit-worker";
pub const NOTIFICATION_GROUP: &str = "auction-notification-worker";
pub const SYNC_GROUP: &str = "auction-sync-worker";
pub const SEARCH_SERVER_GROUP: &str = "auction-search-server";

fn load_workspace_env() {
    let Ok(current_dir) = env::current_dir() else {
        return;
    };

    let Some(workspace_root) = current_dir
        .ancestors()
        .find(|directory| directory.join(".git").exists())
    else {
        return;
    };

    let env_file = workspace_root.join(".env");
    if Path::new(&env_file).is_file() {
        let _ = dotenvy::from_path(env_file);
    }
}

pub fn brokers() -> String {
    if let Ok(brokers) = env::var("KAFKA_BROKERS") {
        return brokers;
    }

    // Local workspace tasks run from apps/<service>, whose service-specific
    // .env files do not contain the shared Kafka configuration. Load missing
    // values from the repository .env without replacing runtime-injected ones.
    load_workspace_env();

    env::var("KAFKA_BROKERS").unwrap_or_else(|_| "127.0.0.1:9092".to_string())
}

fn client_config() -> ClientConfig {
    load_workspace_env();
    let mut config = ClientConfig::new();
    config
        .set("bootstrap.servers", brokers())
        .set("client.id", service_name());

    for (env_name, kafka_name) in [
        ("KAFKA_SECURITY_PROTOCOL", "security.protocol"),
        ("KAFKA_SASL_MECHANISM", "sasl.mechanism"),
        ("KAFKA_USERNAME", "sasl.username"),
        ("KAFKA_PASSWORD", "sasl.password"),
    ] {
        if let Ok(value) = env::var(env_name) {
            config.set(kafka_name, value);
        }
    }

    if let Ok(encoded_ca) = env::var("KAFKA_SSL_CA_BASE64") {
        let ca_bytes = STANDARD
            .decode(encoded_ca.trim())
            .expect("KAFKA_SSL_CA_BASE64 must be valid base64");
        let ca_pem = String::from_utf8(ca_bytes)
            .expect("KAFKA_SSL_CA_BASE64 must decode to a UTF-8 CA certificate");
        config.set("ssl.ca.pem", ca_pem);
    }

    config
}

pub fn producer() -> Result<FutureProducer, KafkaError> {
    client_config()
        .set("enable.idempotence", "true")
        .set("acks", "all")
        .set("message.timeout.ms", "10000")
        .set("compression.type", "lz4")
        .create()
}

pub fn consumer(group_id: &str, topics: &[&str]) -> Result<StreamConsumer, KafkaError> {
    let consumer: StreamConsumer = client_config()
        .set("group.id", group_id)
        .set("enable.auto.commit", "false")
        .set("enable.auto.offset.store", "false")
        .set("auto.offset.reset", "earliest")
        .set("session.timeout.ms", "45000")
        .set("max.poll.interval.ms", "300000")
        .create()?;
    consumer.subscribe(topics)?;
    Ok(consumer)
}

pub async fn publish(
    producer: &FutureProducer,
    topic: &str,
    key: &str,
    payload: &[u8],
) -> Result<(i32, i64), String> {
    producer
        .send(
            FutureRecord::to(topic).key(key).payload(payload),
            Timeout::After(Duration::from_secs(10)),
        )
        .await
        .map(|delivery| (delivery.partition, delivery.offset))
        .map_err(|(error, _)| error.to_string())
}

pub async fn ensure_topics() -> Result<(), String> {
    let partitions = env::var("KAFKA_BID_PARTITIONS")
        .ok()
        .and_then(|value| value.parse::<i32>().ok())
        .unwrap_or(32)
        .max(1);
    let replicas = env::var("KAFKA_REPLICATION_FACTOR")
        .ok()
        .and_then(|value| value.parse::<i32>().ok())
        .unwrap_or(1)
        .max(1);
    let background_partitions = env::var("KAFKA_BACKGROUND_PARTITIONS")
        .ok()
        .and_then(|value| value.parse::<i32>().ok())
        .unwrap_or(8)
        .max(1);
    let bid_retention = env_i64("KAFKA_BID_RETENTION_MS", 2_592_000_000);
    let decision_retention = env_i64("KAFKA_DECISION_RETENTION_MS", 7_776_000_000);
    let notification_retention = env_i64("KAFKA_NOTIFICATION_RETENTION_MS", 604_800_000);
    let sync_retention = env_i64("KAFKA_SYNC_RETENTION_MS", 2_592_000_000);
    let dlq_retention = env_i64("KAFKA_DLQ_RETENTION_MS", 7_776_000_000);
    let bid_retention = bid_retention.to_string();
    let decision_retention = decision_retention.to_string();
    let notification_retention = notification_retention.to_string();
    let sync_retention = sync_retention.to_string();
    let dlq_retention = dlq_retention.to_string();
    let admin: AdminClient<DefaultClientContext> = client_config()
        .create()
        .map_err(|error: KafkaError| error.to_string())?;
    let topics = [
        NewTopic::new(BID_TOPIC, partitions, TopicReplication::Fixed(replicas))
            .set("cleanup.policy", "delete")
            .set("retention.ms", &bid_retention),
        NewTopic::new(
            BID_DECISION_TOPIC,
            background_partitions,
            TopicReplication::Fixed(replicas),
        )
        .set("cleanup.policy", "delete")
        .set("retention.ms", &decision_retention),
        NewTopic::new(
            NOTIFICATION_TOPIC,
            background_partitions,
            TopicReplication::Fixed(replicas),
        )
        .set("cleanup.policy", "delete")
        .set("retention.ms", &notification_retention),
        NewTopic::new(
            SYNC_TOPIC,
            background_partitions,
            TopicReplication::Fixed(replicas),
        )
        .set("cleanup.policy", "delete")
        .set("retention.ms", &sync_retention),
        NewTopic::new(
            DLQ_TOPIC,
            background_partitions,
            TopicReplication::Fixed(replicas),
        )
        .set("cleanup.policy", "delete")
        .set("retention.ms", &dlq_retention),
        NewTopic::new(
            CDC_AUCTIONS_TOPIC,
            background_partitions,
            TopicReplication::Fixed(replicas),
        )
        .set("cleanup.policy", "delete")
        .set("retention.ms", &sync_retention),
        NewTopic::new(
            CDC_AUCTION_LISTINGS_TOPIC,
            background_partitions,
            TopicReplication::Fixed(replicas),
        )
        .set("cleanup.policy", "delete")
        .set("retention.ms", &sync_retention),
    ];
    let results = admin
        .create_topics(&topics, &AdminOptions::new())
        .await
        .map_err(|error| error.to_string())?;
    for result in results {
        if let Err((topic, error)) = result {
            let message = error.to_string();
            if !message.contains("TopicAlreadyExists")
                && !message.to_ascii_lowercase().contains("already exists")
            {
                return Err(format!("failed to create topic {topic}: {error}"));
            }
        }
    }
    Ok(())
}

fn env_i64(name: &str, default: i64) -> i64 {
    env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
        .max(60_000)
}

fn service_name() -> String {
    env::var("KAFKA_CLIENT_ID")
        .or_else(|_| env::var("HOSTNAME"))
        .unwrap_or_else(|_| "auction-service".to_string())
}
