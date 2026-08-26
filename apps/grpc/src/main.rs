use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use grpc_client::bid::bid_service_server::{BidService, BidServiceServer};
use grpc_client::bid::{PlaceBidRequest, PlaceBidResponse};
use rdkafka::producer::FutureProducer;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tonic::transport::Server;
use tonic::{Request, Response, Status};
use uuid::Uuid;

// ─── Shared Ingestion State ──────────────────────────────────────────────────
pub struct IngestionState {
    pub kafka_producer: FutureProducer,
}

impl IngestionState {
    #[tracing::instrument(
        name = "publish_bid",
        skip(self, req),
        fields(
            auction.id = %req.auction_id,
            bidder.id = %req.user_id,
            request.id = %req.request_id,
            bid.amount = req.bid,
        )
    )]
    pub async fn publish_bid(&self, req: &PlaceBidRequest) -> Result<(), String> {
        // Basic sanity checks & UUID validation
        if req.auction_id.is_empty() {
            return Err("Auction ID cannot be empty".to_string());
        }
        if req.user_id.is_empty() {
            return Err("User ID cannot be empty".to_string());
        }
        if req.bid <= 0.0 {
            return Err("Bid amount must be greater than zero".to_string());
        }
        let auction_uuid = Uuid::parse_str(&req.auction_id)
            .map_err(|e| format!("Invalid auction UUID format: {}", e))?;
        let bidder_uuid = Uuid::parse_str(&req.user_id)
            .map_err(|e| format!("Invalid user UUID format: {}", e))?;
        let request_id = if req.request_id.is_empty() {
            Uuid::new_v4().to_string()
        } else {
            Uuid::parse_str(&req.request_id)
                .map_err(|e| format!("Invalid request UUID format: {}", e))?
                .to_string()
        };

        let timestamp = if req.bid_time <= 0 {
            chrono::Utc::now().timestamp_millis()
        } else if req.bid_time < 1_000_000_000_000 {
            req.bid_time.saturating_mul(1_000)
        } else {
            req.bid_time
        };

        // Prepare structured raw bid packet
        let bid_packet = json!({
            "request_id": request_id.clone(),
            "trace_context": auction_observability::current_trace_context(),
            "auction_id": auction_uuid,
            "bidder_id": bidder_uuid,
            "username": if req.username.is_empty() { None } else { Some(&req.username) },
            "amount": req.bid,
            "timestamp": timestamp,
        });

        let payload_bytes = serde_json::to_vec(&bid_packet).map_err(|error| {
            auction_observability::report_error(
                "grpc-ingestion",
                "bid_serialization",
                error.to_string(),
                json!({"auction_id": req.auction_id, "request_id": request_id}),
            );
            format!("Serialization error: {error}")
        })?;

        // Kafka hashes the auction ID key to one partition. All bids for an
        // auction therefore keep producer order while unrelated auctions fan out.
        auction_kafka::publish(
            &self.kafka_producer,
            auction_kafka::BID_TOPIC,
            &req.auction_id,
            &payload_bytes,
        )
        .await
        .map_err(|error| {
            auction_observability::report_error(
                "grpc-ingestion",
                "bid_publish",
                error.clone(),
                json!({"auction_id": req.auction_id, "request_id": request_id}),
            );
            format!("Kafka publish failed: {error}")
        })?;
        println!(
            "[ingestion] bid {request_id} queued for auction {} on Kafka",
            req.auction_id
        );
        Ok(())
    }
}

// ─── Tonic gRPC Service Implementation ───────────────────────────────────────
struct BidServiceImpl {
    state: Arc<IngestionState>,
}

#[tonic::async_trait]
impl BidService for BidServiceImpl {
    async fn place_bid(
        &self,
        request: Request<PlaceBidRequest>,
    ) -> Result<Response<PlaceBidResponse>, Status> {
        let req = request.into_inner();
        println!(
            "[gRPC Gatekeeper] Inbound PlaceBid for auction: {}, user: {}, amount: {}",
            req.auction_id, req.user_id, req.bid
        );

        match self.state.publish_bid(&req).await {
            Ok(()) => Ok(Response::new(PlaceBidResponse {
                successful: true,
                state: "QUEUED".to_string(),
                error: String::new(),
            })),
            Err(err_msg) => Ok(Response::new(PlaceBidResponse {
                successful: false,
                state: "REJECTED".to_string(),
                error: err_msg,
            })),
        }
    }
}

// ─── Axum REST / HTTP DTOs & Handlers ─────────────────────────────────────────
#[derive(Deserialize, Serialize, Clone)]
pub struct HttpBidPayload {
    pub auction_id: String,
    pub user_id: String,
    pub username: Option<String>,
    pub amount: f64,
    pub request_id: Option<String>,
}

async fn health_check() -> &'static str {
    "Ingestion Service OK (Kafka partitioned ingestion)"
}

async fn handle_http_bid(
    State(state): State<Arc<IngestionState>>,
    Json(payload): Json<HttpBidPayload>,
) -> impl IntoResponse {
    let grpc_req = PlaceBidRequest {
        auction_id: payload.auction_id,
        user_id: payload.user_id,
        username: payload.username.unwrap_or_default(),
        bid: payload.amount,
        bid_time: chrono::Utc::now().timestamp(),
        request_id: payload.request_id.unwrap_or_default(),
    };

    match state.publish_bid(&grpc_req).await {
        Ok(()) => (
            StatusCode::OK,
            Json(json!({
                "successful": true,
                "state": "QUEUED",
                "error": "",
            })),
        )
            .into_response(),
        Err(err) => (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "successful": false,
                "state": "REJECTED",
                "error": err,
            })),
        )
            .into_response(),
    }
}

// ─── Main Server Bootstrapper ────────────────(Ingestion Service)──────────────
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let _telemetry = auction_observability::init_telemetry("grpc-ingestion")?;
    if let Err(error) = run().await {
        auction_observability::report_error(
            "grpc-ingestion",
            "service_exit",
            error.to_string(),
            serde_json::json!({"fatal": true}),
        );
        return Err(error);
    }
    Ok(())
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Establish Kafka producer and ensure the fixed topic topology exists.
    let mut kafka_retry = 1u64;
    let kafka_producer = loop {
        match auction_kafka::producer() {
            Ok(producer) => match auction_kafka::ensure_topics().await {
                Ok(()) => break producer,
                Err(error) => {
                    auction_observability::report_error(
                        "grpc-ingestion",
                        "topic_setup",
                        error,
                        json!({"retry_in_seconds": kafka_retry}),
                    );
                }
            },
            Err(e) => {
                auction_observability::report_error(
                    "grpc-ingestion",
                    "producer_setup",
                    e.to_string(),
                    json!({"retry_in_seconds": kafka_retry}),
                );
            }
        }
        tokio::time::sleep(std::time::Duration::from_secs(kafka_retry)).await;
        kafka_retry = std::cmp::min(kafka_retry * 2, 60);
    };
    let state = Arc::new(IngestionState { kafka_producer });

    // 2. Axum REST HTTP ingestion endpoint on its own port.
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/bid", post(handle_http_bid))
        .with_state(state.clone());

    let http_port = std::env::var("HTTP_PORT").unwrap_or_else(|_| "8083".to_string());
    let http_addr = format!("0.0.0.0:{}", http_port);
    println!("[Ingestion Gateway] HTTP server listening on {}", http_addr);

    let listener = tokio::net::TcpListener::bind(&http_addr).await?;
    tokio::spawn(async move {
        if let Err(error) = axum::serve(listener, app).await {
            auction_observability::report_error(
                "grpc-ingestion",
                "http_server_exit",
                error.to_string(),
                serde_json::json!({"listener": "http"}),
            );
        }
    });

    // 3. Tonic gRPC Ingestion Server on port 50051
    let grpc_port = std::env::var("PORT").unwrap_or_else(|_| "50051".to_string());
    let grpc_addr = format!("[::]:{}", grpc_port).parse()?;
    println!(
        "[gRPC Gatekeeper] Ingestion server listening on {}",
        grpc_addr
    );

    let grpc_service = BidServiceImpl { state };
    Server::builder()
        .add_service(BidServiceServer::new(grpc_service))
        .serve(grpc_addr)
        .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bid_request_payload_sanity() {
        let req = PlaceBidRequest {
            auction_id: "00000000-0000-0000-0000-000000000000".to_string(),
            user_id: "00000000-0000-0000-0000-000000000001".to_string(),
            username: "bidder1".to_string(),
            bid: 100.50,
            bid_time: 1700000000,
            request_id: Uuid::new_v4().to_string(),
        };
        assert!(Uuid::parse_str(&req.auction_id).is_ok());
        assert!(Uuid::parse_str(&req.user_id).is_ok());
        assert!(req.bid > 0.0);
    }
}
