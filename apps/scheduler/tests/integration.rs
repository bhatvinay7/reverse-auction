#[test]
fn scheduler_activation_payload_keeps_auction_identity() {
    let auction_id = uuid::Uuid::new_v4();
    let payload = serde_json::json!({
        "auction_id": auction_id,
        "action": "ACTIVATE_AUCTION",
        "scheduled_time": chrono::Utc::now().to_rfc3339(),
    });
    assert_eq!(payload["auction_id"], auction_id.to_string());
    assert_eq!(payload["action"], "ACTIVATE_AUCTION");
}
