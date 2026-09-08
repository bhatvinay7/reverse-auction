mod auction_access;
mod auth;
mod circuit_breaker;
mod error;
mod internal_identity;
mod proxy;
mod state;
mod throttle;
mod websocket_proxy;

use std::{net::SocketAddr, time::Duration};

use axum::{
    Router,
    extract::DefaultBodyLimit,
    http::{header, HeaderValue, Method},
    routing::{any, get, post},
};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};
use tracing::info;

use crate::state::GatewayState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Support launching from either the workspace root or this crate's directory.
    // Existing process variables always take precedence over values from dotenv files.
    dotenvy::dotenv().ok();
    let _telemetry = auction_observability::init_telemetry("gateway-keeper")?;
    if let Err(error) = run().await {
        auction_observability::report_error(
            "gateway-keeper",
            "service_exit",
            error.to_string(),
            serde_json::json!({"fatal": true}),
        );
        return Err(error);
    }
    Ok(())
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let state = GatewayState::from_env().await?;
    let allowed_origins_str = std::env::var("CORS_ALLOWED_ORIGIN")
        .unwrap_or_else(|_| "http://localhost:3000".into());
    let allowed_origins: Vec<HeaderValue> = allowed_origins_str
        .split(',')
        .map(|s| s.trim().parse::<HeaderValue>().unwrap())
        .collect();

    let app = Router::new()
        .route("/health", get(proxy::health))
        .route("/readyz", get(proxy::ready))
        .route("/api/socket-ticket", post(websocket_proxy::create_ticket))
        .route("/socket.io", get(websocket_proxy::socket_proxy))
        .route("/socket.io/{*path}", get(websocket_proxy::socket_proxy))
        .route("/api/search", any(proxy::search_proxy))
        .route("/api/{*path}", any(proxy::http_proxy))
        .with_state(state)
        .layer(DefaultBodyLimit::max(25 * 1024 * 1024))
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::list(allowed_origins))
                .allow_credentials(true)
                .allow_headers([
                    header::ACCEPT,
                    header::AUTHORIZATION,
                    header::CONTENT_TYPE,
                    header::ORIGIN,
                    header::HOST,
                    header::COOKIE,
                    axum::http::header::HeaderName::from_static("x-requested-with"),
                    axum::http::header::HeaderName::from_static("x-auth-token"),
                ])
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::PATCH,
                    Method::DELETE,
                    Method::OPTIONS,
                ])
                .max_age(Duration::from_secs(3600)),
        );

    let addr: SocketAddr = std::env::var("GATEWAY_KEEPER_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:8080".into())
        .parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    info!(%addr, "auction gateway keeper listening");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(error) = tokio::signal::ctrl_c().await {
            auction_observability::report_error(
                "gateway-keeper",
                "signal_handler",
                error.to_string(),
                serde_json::json!({"signal": "ctrl_c"}),
            );
        }
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(error) => auction_observability::report_error(
                "gateway-keeper",
                "signal_handler",
                error.to_string(),
                serde_json::json!({"signal": "terminate"}),
            ),
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = terminate => {} }
}
