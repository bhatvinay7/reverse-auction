use ws_server::auth;

use axum::routing::get;
use futures_util::StreamExt;
use redis::AsyncCommands;
use serde::Deserialize;
use socketioxide::{
    SocketIo,
    adapter::Adapter,
    extract::{Data, SocketRef, State},
};
use socketioxide_redis::{RedisAdapter, RedisAdapterCtr};
use std::sync::Arc;
use tower_http::cors::CorsLayer;

struct AppState {
    redis_pool: bb8::Pool<bb8_redis::RedisConnectionManager>,
    grpc_url: String,
}

#[derive(Deserialize, Debug)]
struct Auth {
    auction_id: String,
    user_id: Option<String>,
    token: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Deserialize, Debug)]
struct InboundBid {
    auction_id: String,
    bidder_id: String,
    username: Option<String>,
    amount: f64,
    timestamp: i64,
    request_id: Option<String>,
}

async fn on_connect<A: Adapter>(
    socket: SocketRef<A>,
    auth_data: Data<serde_json::Value>,
    state: State<Arc<AppState>>,
) {
    println!("Incoming connection auth payload: {:?}", auth_data.0);

    let auth: Auth = match serde_json::from_value(auth_data.0.clone()) {
        Ok(a) => a,
        Err(e) => {
            println!("Failed to parse auth payload: {:?}", e);
            let _ = socket.disconnect();
            return;
        }
    };

    let auction_id = auth.auction_id.clone();
    println!("Client connected via Socket.IO for auction: {}", auction_id);

    let mut redis_conn = match state.redis_pool.get().await {
        Ok(c) => c,
        Err(e) => {
            println!("Failed to get redis connection: {}", e);
            let _ = socket.disconnect();
            return;
        }
    };

    match auth::is_auction_initialized(&mut *redis_conn, &auction_id).await {
        Ok(true) => {}
        Ok(false) => {
            println!(
                "Auction {} not initialized yet or has expired. Allowing connection to wait.",
                auction_id
            );
            socket.join(auction_id.clone());
            return;
        }
        Err(error) => {
            println!(
                "Failed to check initialization for auction {}: {}",
                auction_id, error
            );
            let _ = socket.disconnect();
            return;
        }
    }

    let mut user_id_str = auth.user_id.unwrap_or_default();

    if let Some(token) = auth.token
        && !token.is_empty()
    {
        let secret = std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| "super_secret_key_change_me".to_string());
        if let Ok(token_data) = jsonwebtoken::decode::<Claims>(
            &token,
            &jsonwebtoken::DecodingKey::from_secret(secret.as_ref()),
            &jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256),
        ) {
            user_id_str = token_data.claims.sub;
        } else {
            println!("[ws-server] Invalid or expired JWT token provided in connection payload");
        }
    }

    let is_participant =
        match auth::validate_participant(&mut *redis_conn, &auction_id, &user_id_str).await {
            Ok(is_part) => is_part,
            Err(e) => {
                println!("Invalid user_id format: {}", e);
                socket.emit("error", &e).ok();
                let _ = socket.disconnect();
                return;
            }
        };

    let validation = match auth::validate_auction_state(&mut *redis_conn, &auction_id).await {
        Ok(v) => v,
        Err(e) => {
            println!("Auction state validation failed: {}", e);
            socket.emit("error", &e).ok();
            let _ = socket.disconnect();
            return;
        }
    };

    if validation.join_expired {
        println!("Joining period for auction {} has expired.", auction_id);
        socket
            .emit("error", "Joining period has expired (5 mins after start)")
            .ok();
        let _ = socket.disconnect();
        return;
    }

    if validation.is_completed {
        let msg = serde_json::json!({
            "event": "auction_closed",
            "data": validation.winner_data
        });
        socket.emit("auction_closed", &msg).ok();
        println!(
            "Auction {} is completed. Emitted closure but keeping connection open for historical view.",
            auction_id
        );
    }

    // Join room
    socket.join(auction_id.clone());

    // 2. Fetch ZSET and emit auction_init
    let zset_key = auction_redis::format_zset_key(&auction_id);
    let current_bids: Result<Vec<String>, _> = if validation.auction_type == "FORWARD" {
        redis_conn.zrevrange(&zset_key, 0, 9).await
    } else {
        redis_conn.zrange(&zset_key, 0, 9).await
    };
    match current_bids {
        Ok(bids) => {
            let mut parsed_bids: Vec<serde_json::Value> = Vec::new();
            for b in bids {
                match serde_json::from_str(&b) {
                    Ok(parsed) => parsed_bids.push(parsed),
                    Err(e) => println!(
                        "[ws-server] JSON parse error for zset entry: {}, raw: {}",
                        e, b
                    ),
                }
            }

            // Fetch live_stream to get historical ledger events (both confirmed and rejected)
            let stream_key = auction_redis::format_live_stream(&auction_id);
            let mut recent_events_parsed: Vec<serde_json::Value> = Vec::new();

            let stream_entries: Result<redis::streams::StreamRangeReply, _> =
                redis_conn.xrevrange_count(&stream_key, "+", "-", 50).await;
            if let Ok(reply) = stream_entries {
                for id in reply.ids {
                    // id.map is a HashMap<String, Value>
                    if let Some(val) = id.map.get("bid_data").or_else(|| id.map.get("failed_data"))
                    {
                        match redis::from_redis_value::<String>(val.clone()) {
                            Ok(json_str) => {
                                match serde_json::from_str::<serde_json::Value>(&json_str) {
                                    Ok(parsed) => {
                                        recent_events_parsed.push(parsed);
                                    }
                                    Err(e) => println!(
                                        "[ws-server] JSON parse error for stream entry: {}, json_str: {}",
                                        e, json_str
                                    ),
                                }
                            }
                            Err(e) => println!(
                                "[ws-server] Failed to convert stream val to String: {:?}",
                                e
                            ),
                        }
                    } else {
                        println!(
                            "[ws-server] No bid_data or failed_data found in stream keys: {:?}",
                            id.map.keys()
                        );
                    }
                }
            }
            // Reverse so they are in chronological order (oldest to newest) since xrevrange gives newest to oldest
            recent_events_parsed.reverse();

            let reload_msg = serde_json::json!({
                "auction_id": auction_id,
                "auction_type": validation.auction_type,
                "minimum_bid_step": validation.minimum_bid_step,
                "leading_bids": parsed_bids,
                "lowest_bids": parsed_bids,
                "recent_events": recent_events_parsed,
                "start_time": validation.auction_start_time_ms,
                "end_time": validation.auction_end_time_ms,
                "initial_price": validation.starting_price,
                "initial_lowest": validation.starting_price,
                "is_participant": is_participant
            });
            println!(
                "[ws-server] Emitting auction_init → auction={} start_ms={} end_ms={} is_participant={} starting_price={:?} lowest_bids={} recent_events={}",
                auction_id,
                validation.auction_start_time_ms,
                validation.auction_end_time_ms,
                is_participant,
                validation.starting_price,
                parsed_bids.len(),
                recent_events_parsed.len()
            );
            match socket.emit("auction_init", &reload_msg) {
                Ok(_) => println!("[ws-server] auction_init emitted successfully to socket"),
                Err(e) => println!("[ws-server] FAILED to emit auction_init: {:?}", e),
            }
        }
        Err(e) => {
            println!("Failed to fetch current bids: {}", e);
        }
    }

    // 3. Handle incoming bids
    socket.on(
        "place_bid",
        |_s: SocketRef<A>, Data::<InboundBid>(inbound), state: State<Arc<AppState>>| async move {
            let mut redis_conn = match state.redis_pool.get().await {
                Ok(c) => c,
                Err(_) => return,
            };

            // Validate Auction State Exists
            let validation =
                match auth::validate_auction_state(&mut *redis_conn, &inbound.auction_id).await {
                    Ok(v) => v,
                    Err(e) => {
                        let _ = _s.emit("error", &e);
                        return;
                    }
                };

            // Validate Participant — Ok(false) means not a participant, Ok(true) means allowed
            let is_participant = match auth::validate_participant(
                &mut *redis_conn,
                &inbound.auction_id,
                &inbound.bidder_id,
            )
            .await
            {
                Ok(is_participant) => is_participant,
                Err(e) => {
                    let _ = _s.emit("error", &e);
                    return;
                }
            };

            if let Err(error) = auth::authorize_bid(&validation, is_participant) {
                let _ = _s.emit("error", error);
                return;
            }

            if let Ok(mut client) = grpc_client::connect(state.grpc_url.clone()).await {
                let bid_req = grpc_client::bid::PlaceBidRequest {
                    auction_id: inbound.auction_id.clone(),
                    user_id: inbound.bidder_id.clone(),
                    username: inbound.username.unwrap_or_default(),
                    bid: inbound.amount,
                    bid_time: inbound.timestamp,
                    request_id: inbound
                        .request_id
                        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
                };
                let request = tonic::Request::new(bid_req);
                match client.place_bid(request).await {
                    Ok(resp) => {
                        let response = resp.into_inner();
                        println!(
                            "[ws-server] Successfully forwarded bid to gRPC. Status: {}, Error: {}",
                            response.state, response.error
                        );
                        if !response.successful {
                            // If gRPC rejected the bid, immediately notify the user
                            let _ = _s.emit("error", &format!("Bid rejected: {}", response.error));
                        } else {
                            // Let the bidder know their bid is successfully queued in the pipeline!
                            let _ = _s.emit(
                                "info",
                                &format!(
                                    "Bid of {} is queued and being processed...",
                                    inbound.amount
                                ),
                            );
                        }
                    }
                    Err(e) => {
                        auction_observability::report_error(
                            "ws-server",
                            "grpc_bid_forward",
                            e.to_string(),
                            serde_json::json!({
                                "auction_id": inbound.auction_id,
                                "bidder_id": inbound.bidder_id,
                            }),
                        );
                        let _ = _s.emit(
                            "error",
                            &"Failed to contact gRPC publisher pipeline.".to_string(),
                        );
                    }
                }
            } else {
                auction_observability::report_error(
                    "ws-server",
                    "grpc_connect",
                    "failed to connect to gRPC bid ingestion",
                    serde_json::json!({"grpc_url": state.grpc_url.clone()}),
                );
            }
        },
    );
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let _telemetry = auction_observability::init_telemetry("ws-server")?;
    if let Err(error) = run().await {
        auction_observability::report_error(
            "ws-server",
            "service_exit",
            error.to_string(),
            serde_json::json!({"fatal": true}),
        );
        return Err(error);
    }
    Ok(())
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting WebSocket server...");

    let redis_client = auction_redis::get_redis_client()
        .map_err(|e| format!("Failed to get redis client: {}", e))?;
    let grpc_url = std::env::var("GRPC_URL").unwrap_or_else(|_| "http://[::1]:50051".to_string());

    let redis_pool = auction_redis::get_redis_pool()
        .await
        .map_err(|e| format!("Failed to get redis pool: {}", e))?;

    let app_state = Arc::new(AppState {
        redis_pool: redis_pool.clone(),
        grpc_url,
    });

    let adapter = RedisAdapterCtr::new_with_redis(&redis_client).await?;
    let (layer, io) = SocketIo::builder()
        .with_state(app_state)
        .with_adapter::<RedisAdapter<_>>(adapter)
        .build_layer();

    io.ns("/", on_connect).await?;

    let io_clone = io.clone();
    let mut redis_pubsub = redis_client.get_async_pubsub().await?;
    tokio::spawn(async move {
        if let Err(e) = redis_pubsub.subscribe("auction:updates").await {
            auction_observability::report_error(
                "ws-server",
                "redis_subscribe",
                e.to_string(),
                serde_json::json!({"channel": "auction:updates"}),
            );
            return;
        }
        let mut stream = redis_pubsub.on_message();
        while let Some(msg) = stream.next().await {
            if let Ok(payload_str) = msg.get_payload::<String>()
                && let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&payload_str)
                && let (Some(auction_id), Some(payload)) =
                    (parsed["auction_id"].as_str(), parsed.get("payload"))
            {
                match io_clone.of("/") {
                    Some(namespace) => {
                        if let Err(error) = namespace
                            .to(auction_id.to_string())
                            .emit("bid_update", payload)
                            .await
                        {
                            auction_observability::report_error(
                                "ws-server",
                                "socket_emit",
                                error.to_string(),
                                serde_json::json!({"auction_id": auction_id}),
                            );
                        }
                    }
                    None => auction_observability::report_error(
                        "ws-server",
                        "socket_namespace_missing",
                        "root Socket.IO namespace is unavailable",
                        serde_json::json!({"auction_id": auction_id}),
                    ),
                }
            }
        }
    });

    let app = axum::Router::new()
        .route("/health", get(|| async { "OK" }))
        .layer(
            tower::ServiceBuilder::new()
                .layer(CorsLayer::permissive())
                .layer(layer),
        );

    let addr = std::env::var("WS_SERVER_ADDR").unwrap_or_else(|_| "0.0.0.0:8081".into());
    println!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
