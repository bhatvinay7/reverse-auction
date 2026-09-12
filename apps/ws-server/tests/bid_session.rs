use ws_server::auth::BidSession;

fn session() -> BidSession {
    BidSession {
        auction_id: "auction-a".into(),
        user_id: "bidder-a".into(),
        token_expires_at_ms: 3_000,
        is_participant: true,
        is_completed: false,
        starts_at_ms: 1_000,
        ends_at_ms: 2_000,
    }
}

#[test]
fn connected_participant_can_submit_without_redis() {
    assert_eq!(session().authorize("auction-a", "bidder-a", 1_500), Ok(()));
}

#[test]
fn cannot_spoof_bidder_or_bid_into_another_room() {
    assert!(session().authorize("auction-a", "bidder-b", 1_500).is_err());
    assert!(session().authorize("auction-b", "bidder-a", 1_500).is_err());
}

#[test]
fn connection_cannot_outlive_auction_or_authentication() {
    assert!(session().authorize("auction-a", "bidder-a", 999).is_err());
    assert!(session().authorize("auction-a", "bidder-a", 2_000).is_err());
    let mut expired = session();
    expired.token_expires_at_ms = 1_500;
    assert!(expired.authorize("auction-a", "bidder-a", 1_500).is_err());
    expired = session();
    expired.is_completed = true;
    assert!(expired.authorize("auction-a", "bidder-a", 1_500).is_err());
}

#[test]
fn spectator_or_unauthenticated_connection_cannot_bid() {
    let mut spectator = session();
    spectator.is_participant = false;
    assert!(spectator.authorize("auction-a", "bidder-a", 1_500).is_err());
    spectator = session();
    spectator.user_id.clear();
    assert!(spectator.authorize("auction-a", "", 1_500).is_err());
}
