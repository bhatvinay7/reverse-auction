pub mod auction;
pub mod auth;
pub mod listing;
pub mod upload;

use crate::state::AppState;
use axum::Router;

pub fn app_router() -> Router<AppState> {
    Router::new()
        .nest("/api/auth", auth::auth_routes())
        .nest(
            "/api/auction",
            auction::auction_routes().route_layer(axum::middleware::from_fn(
                crate::middleware::auth_middleware,
            )),
        )
        .nest(
            "/api/upload",
            upload::upload_routes().route_layer(axum::middleware::from_fn(
                crate::middleware::auth_middleware,
            )),
        )
        .nest(
            "/api/listings",
            listing::listing_routes().route_layer(axum::middleware::from_fn(
                crate::middleware::auth_middleware,
            )),
        )
}
