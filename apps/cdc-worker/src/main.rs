mod config;
mod decoder;
mod processor;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    dotenvy::dotenv().ok();
    rustls::crypto::ring::default_provider()
        .install_default()
        .ok();
    eprintln!("[CDC] worker starting");

    let _telemetry = auction_observability::init_telemetry("cdc-worker")?;

    processor::run().await
}
