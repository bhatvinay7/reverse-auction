use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;
use uuid::Uuid;

pub use db::models::AuctionType;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BidRequest {
    pub auction_id: Uuid,
    pub bidder_id: String,
    pub username: Option<String>,
    pub amount: f64,
    pub timestamp: i64,
}

pub struct AuctionTask {
    pub request_id: String,
    pub bid: BidRequest,
    pub source_topic: String,
    pub source_partition: i32,
    pub source_offset: i64,
    pub trace_context: HashMap<String, String>,
    pub respond_to: oneshot::Sender<AuctionTaskResult>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuctionTaskResult {
    Committed,
    Rejected(String),
    Retryable(String),
}

#[derive(Debug)]
pub struct AuctionRuntime {
    pub auction_type: AuctionType,
    pub current_price: f64,
    pub minimum_bid_step: f64,
    pub reserve_price: Option<f64>,
    pub end_timestamp_ms: i64,
}

pub fn is_better_bid(
    auction_type: AuctionType,
    current_price: f64,
    amount: f64,
    minimum_bid_step: f64,
) -> bool {
    if !amount.is_finite()
        || amount <= 0.0
        || !current_price.is_finite()
        || !minimum_bid_step.is_finite()
        || minimum_bid_step <= 0.0
    {
        return false;
    }

    match auction_type {
        AuctionType::Reverse => amount <= current_price - minimum_bid_step,
        AuctionType::Forward => amount >= current_price + minimum_bid_step,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActorExit {
    AuctionEnded,
    ChannelClosed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LedgerWrite {
    Applied,
    Duplicate,
}

#[cfg(test)]
mod tests {
    use super::{AuctionType, is_better_bid};

    #[test]
    fn reverse_auction_accepts_only_a_sufficiently_lower_bid() {
        assert!(is_better_bid(AuctionType::Reverse, 100.0, 95.0, 5.0));
        assert!(!is_better_bid(AuctionType::Reverse, 100.0, 96.0, 5.0));
        assert!(!is_better_bid(AuctionType::Reverse, 100.0, 105.0, 5.0));
    }

    #[test]
    fn forward_auction_accepts_only_a_sufficiently_higher_bid() {
        assert!(is_better_bid(AuctionType::Forward, 100.0, 105.0, 5.0));
        assert!(!is_better_bid(AuctionType::Forward, 100.0, 104.0, 5.0));
        assert!(!is_better_bid(AuctionType::Forward, 100.0, 95.0, 5.0));
    }

    #[test]
    fn bid_rule_rejects_invalid_money_values() {
        assert!(!is_better_bid(AuctionType::Forward, 100.0, f64::NAN, 1.0));
        assert!(!is_better_bid(AuctionType::Reverse, 100.0, 0.0, 1.0));
        assert!(!is_better_bid(AuctionType::Forward, 100.0, 101.0, 0.0));
    }
}
use std::collections::HashMap;
