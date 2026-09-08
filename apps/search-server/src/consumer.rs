#![allow(clippy::collapsible_if)]

use rdkafka::{
    consumer::StreamConsumer,
    Message,
};
use elasticsearch::{DeleteParts, IndexParts};
use serde_json::{json, Value};

use crate::AppState;

pub async fn run_consumer(state: AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    auction_kafka::ensure_topics().await?;
    let consumer: StreamConsumer = auction_kafka::consumer(
        auction_kafka::SEARCH_SERVER_GROUP,
        &[
            auction_kafka::CDC_AUCTIONS_TOPIC,
            auction_kafka::CDC_AUCTION_LISTINGS_TOPIC,
        ],
    )?;

    eprintln!("[Search-Server] Kafka consumer started on CDC topics");

    loop {
        let msg = match consumer.recv().await {
            Ok(m) => m,
            Err(e) => {
                eprintln!("[Search-Server] Kafka consume error: {}", e);
                continue;
            }
        };

        let payload = match msg.payload() {
            Some(p) => p,
            None => continue,
        };

        let mut doc: Value = match serde_json::from_slice(payload) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let id = match doc["id"].as_str() {
            Some(i) => i.to_string(),
            None => continue,
        };

        if doc["_deleted"] == json!(true) {
            eprintln!("[Search-Server] Deleting document {}", id);
            let _ = state
                .es_client
                .delete(DeleteParts::IndexId("auctions_idx", &id))
                .send()
                .await;
        } else {
            // Generate embedding for title + description
            let title = doc["title"].as_str().unwrap_or_default();
            let description = doc["description"].as_str().unwrap_or_default();
            let text_to_embed = format!("{} {}", title, description);

            if !text_to_embed.trim().is_empty() {
                if let Ok(embedding) = crate::openai::generate_embedding(
                    &state.openai_client,
                    &state.openai_api_key,
                    &text_to_embed,
                )
                .await {
                    if let Some(obj) = doc.as_object_mut() {
                        obj.insert("embedding".to_string(), json!(embedding));
                    }
                }
            }

            eprintln!("[Search-Server] Indexing document {}", id);
            let response = state
                .es_client
                .index(IndexParts::IndexId("auctions_idx", &id))
                .body(&doc)
                .send()
                .await;

            if let Err(e) = response {
                eprintln!("[Search-Server] Failed to index document {}: {}", id, e);
            }
        }
    }
}
