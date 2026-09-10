use crate::controllers::auction::{
    create_auction_handler, get_auction_history_handler, get_auctions_handler,
    join_auction_handler, leave_auction_handler,
};
use crate::state::AppState;
use axum::{
    middleware,
    routing::{get, post},
    Router,
};

pub fn auction_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(get_auctions_handler))
        .route("/history", get(get_auction_history_handler))
        .route(
            "/create",
            post(create_auction_handler)
                .route_layer(middleware::from_fn(crate::middleware::require_admin)),
        )
        .route("/:auction_id/join", post(join_auction_handler))
        .route("/:auction_id/leave", post(leave_auction_handler))
        .route(
            "/:auction_id/bids",
            get(crate::controllers::auction::get_auction_bids_handler),
        )
        .route(
            "/:auction_id/audit",
            get(crate::controllers::auction::get_bid_audit_handler),
        )
        .route(
            "/:auction_id/discussion",
            get(crate::controllers::auction::get_auction_discussion_handler)
                .post(crate::controllers::auction::post_auction_discussion_handler),
        )
}
