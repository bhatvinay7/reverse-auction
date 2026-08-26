use dotenvy::dotenv;
use std::net::SocketAddr;

use http_server::routes::app_router;
use http_server::state::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = dotenv();
    let _telemetry = auction_observability::init_telemetry("http-server")?;
    if let Err(error) = run().await {
        auction_observability::report_error(
            "http-server",
            "service_exit",
            error.to_string(),
            serde_json::json!({"fatal": true}),
        );
        return Err(error);
    }
    Ok(())
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let pool = db::get_connection_pool();

    let redis_pool = auction_redis::get_redis_pool()
        .await
        .map_err(|error| format!("failed to create Redis pool for http-server: {error}"))?;

    let state = AppState {
        db_pool: pool,
        redis_pool,
    };

    use tower_http::{
        cors::{Any, CorsLayer},
        trace::TraceLayer,
    };
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
        ]);

    let app = app_router()
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = std::env::var("HTTP_SERVER_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:8080".to_string())
        .parse()?;
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
