use crate::controllers::upload::upload_media;
use crate::state::AppState;
use axum::{routing::post, Router};

pub fn upload_routes() -> Router<AppState> {
    Router::new().route("/", post(upload_media))
}
