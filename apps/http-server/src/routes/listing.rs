use crate::{controllers::listing, middleware, state::AppState};
use axum::{
    middleware as axum_middleware,
    routing::{get, post, put},
    Router,
};

pub fn listing_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            post(listing::create)
                .route_layer(axum_middleware::from_fn(middleware::require_customer)),
        )
        .route(
            "/mine",
            get(listing::mine).route_layer(axum_middleware::from_fn(middleware::require_customer)),
        )
        .route(
            "/:id",
            put(listing::update)
                .route_layer(axum_middleware::from_fn(middleware::require_customer)),
        )
        .route(
            "/:id/resubmit",
            post(listing::resubmit)
                .route_layer(axum_middleware::from_fn(middleware::require_customer)),
        )
        .route("/:id/history", get(listing::history))
        .route(
            "/admin",
            get(listing::all).route_layer(axum_middleware::from_fn(middleware::require_admin)),
        )
        .route(
            "/:id/review",
            post(listing::review).route_layer(axum_middleware::from_fn(middleware::require_admin)),
        )
        .route(
            "/:id/schedule",
            post(listing::schedule)
                .route_layer(axum_middleware::from_fn(middleware::require_admin)),
        )
}
