use ws_server::auth::{self, AuctionValidationResult};

fn active_auction() -> AuctionValidationResult {
    AuctionValidationResult {
        is_completed: false,
        join_expired: false,
        auction_start_time_ms: 1,
        auction_end_time_ms: i64::MAX,
        starting_price: Some(100.0),
        auction_type: "REVERSE".into(),
        minimum_bid_step: 1.0,
        winner_data: None,
    }
}

#[test]
fn scheduler_initialization_marker_is_the_one_ws_server_accepts() {
    // The scheduler HSETs this field in auction:initialized_hash. A former
    // string-key lookup made every auction appear uninitialized to ws-server.
    assert_eq!(
        auction_redis::AUCTION_INITIALIZED_HASH_KEY,
        "auction:initialized_hash"
    );
    assert!(auth::is_initialized_value(Some("1")));
    assert!(!auth::is_initialized_value(Some("0")));
    assert!(!auth::is_initialized_value(None));
}

#[test]
fn joined_user_uses_the_same_bitmap_key_as_scheduler_and_websocket() {
    let auction_id = "d496c9b3-9bf9-48d8-ac5b-6b194b717e7c";
    assert_eq!(
        auction_redis::format_participants_key(auction_id),
        "{d496c9b3-9bf9-48d8-ac5b-6b194b717e7c}:participants"
    );
}

#[test]
fn websocket_forwards_bids_only_for_active_registered_users() {
    let active = active_auction();
    assert_eq!(
        auth::authorize_bid(&active, false),
        Err("You are not a participant in this auction.")
    );
    assert_eq!(auth::authorize_bid(&active, true), Ok(()));

    let mut completed = active;
    completed.is_completed = true;
    assert_eq!(
        auth::authorize_bid(&completed, true),
        Err("Auction has ended.")
    );
}
