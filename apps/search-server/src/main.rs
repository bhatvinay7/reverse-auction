mod consumer;
mod es;
mod openai;

use axum::{
    Json, Router,
    extract::{Query, State},
    routing::get,
};
use serde::Deserialize;

#[derive(Clone)]
pub struct AppState {
    pub es_client: elasticsearch::Elasticsearch,
    pub openai_client: reqwest::Client,
    pub openai_api_key: String,
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
    pub category: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    dotenvy::dotenv().ok();
    let _telemetry = auction_observability::init_telemetry("search-server")?;

    let es_url =
        std::env::var("ELASTICSEARCH_URL").unwrap_or_else(|_| "http://localhost:9200".into());
    let transport = elasticsearch::http::transport::Transport::single_node(&es_url)?;
    let es_client = elasticsearch::Elasticsearch::new(transport);

    let openai_api_key = std::env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY must be set");

    // Ensure ES index is setup
    es::setup_index(&es_client).await?;

    let state = AppState {
        es_client: es_client.clone(),
        openai_client: reqwest::Client::new(),
        openai_api_key: openai_api_key.clone(),
    };

    // Start Kafka consumer in background
    let consumer_state = state.clone();
    tokio::spawn(async move {
        if let Err(e) = consumer::run_consumer(consumer_state).await {
            eprintln!("[Search-Server] Kafka consumer failed: {}", e);
        }
    });

    let app = Router::new()
        .route("/api/search", get(search_handler))
        .route("/health", get(|| async { "OK" }))
        .with_state(state);

    let addr = std::env::var("SEARCH_SERVER_BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8081".into());
    eprintln!("[Search-Server] Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn search_handler(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Json<serde_json::Value> {
    match es::search(&state, query).await {
        Ok(results) => Json(results),
        Err(e) => {
            eprintln!("[Search-Server] Search error: {}", e);
            Json(serde_json::json!({ "error": e.to_string() }))
        }
    }
}
