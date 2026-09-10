use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NotificationPayload {
    pub event_type: Option<String>,
    pub auction_id: Option<String>,
    pub email: Option<String>,
    pub message: String,
    #[serde(default)]
    pub retry_count: i32,
}

#[derive(Deserialize, Debug)]
pub struct BidDecisionPayload {
    pub request_id: String,
    pub bid: AuditedBidPayload,
    pub auction_type: db::models::AuctionType,
    pub is_executed: bool,
    pub rejection_reason: Option<String>,
    pub previous_price: f64,
    pub resulting_price: f64,
    pub processed_at: i64,
    pub source_topic: String,
    pub source_partition: i32,
    pub source_offset: i64,
}

#[derive(Deserialize, Debug)]
pub struct AuditedBidPayload {
    pub auction_id: uuid::Uuid,
    pub bidder_id: String,
    pub username: Option<String>,
    pub amount: f64,
    pub timestamp: i64,
}

#[derive(diesel::QueryableByName)]
pub struct IdRow {
    #[diesel(sql_type = diesel::sql_types::Uuid)]
    pub id: uuid::Uuid,
}
