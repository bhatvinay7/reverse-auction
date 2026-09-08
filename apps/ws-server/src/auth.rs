use serde_json::Value;
use uuid::Uuid;

pub struct AuctionValidationResult {
    pub is_completed: bool,
    pub join_expired: bool,
    pub auction_start_time_ms: i64,
    pub auction_end_time_ms: i64,
    pub starting_price: Option<f64>,
    pub auction_type: String,
    pub minimum_bid_step: f64,
    pub winner_data: Option<Value>,
}

pub async fn validate_participant<C: redis::AsyncCommands>(
    redis_conn: &mut C,
    auction_id: &str,
    user_id_str: &str,
) -> Result<bool, String> {
    if user_id_str.is_empty() {
        println!("[ws-server][participant] user_id is EMPTY — is_participant=false");
        return Ok(false);
    }
    if let Ok(user_uuid) = Uuid::parse_str(user_id_str) {
        let offset = (user_uuid.as_u128() % (1 << 31)) as u32;
        let bitmap_key = format!("auction:participants:{}", auction_id);
        let raw: Result<i64, _> = redis_conn.getbit(&bitmap_key, offset as usize).await;
        println!(
            "[ws-server][participant] user={} offset={} bitmap_key={} raw_bit={:?}",
            user_id_str, offset, bitmap_key, raw
        );
        match raw {
            Ok(1) => Ok(true),
            Ok(_) => Ok(false),
            Err(e) => {
                println!("[ws-server][participant] Redis GETBIT error: {}", e);
                Ok(false)
            }
        }
    } else {
        println!(
            "[ws-server][participant] user_id '{}' is NOT a valid UUID",
            user_id_str
        );
        Ok(false)
    }
}

pub async fn validate_auction_state<C: redis::AsyncCommands>(
    redis_conn: &mut C,
    auction_id: &str,
) -> Result<AuctionValidationResult, String> {
    let state_str: Result<Option<String>, _> = redis_conn
        .hget(auction_redis::AUCTION_STATE_HASH_KEY, auction_id)
        .await;
    println!(
        "[ws-server] HGET {} {} -> {:?}",
        auction_redis::AUCTION_STATE_HASH_KEY,
        auction_id,
        state_str
    );

    let mut is_completed = false;
    let join_expired = false;
    let mut auction_start_time_ms = 0;
    let mut auction_end_time_ms = 0;
    let mut starting_price = None;
    let mut auction_type = "REVERSE".to_string();
    let mut minimum_bid_step = 1.0;

    if let Ok(Some(s)) = state_str {
        if let Ok(state_json) = serde_json::from_str::<Value>(&s) {
            // Read auction_start_time from the shipment (the actual bidding window),
            // not from schedule.start_time (which is the scheduler trigger time).
            if let Some(schedule) = state_json.get("schedule")
                && let Some(start_time_str) = schedule.get("start_time").and_then(|st| st.as_str())
                {
                    let st_str = start_time_str.trim_end_matches('Z');
                    let start_time =
                        chrono::NaiveDateTime::parse_from_str(st_str, "%Y-%m-%dT%H:%M:%S%.f")
                            .or_else(|_| {
                                chrono::NaiveDateTime::parse_from_str(st_str, "%Y-%m-%dT%H:%M:%S")
                            });
                    if let Ok(st) = start_time {
                        // Use schedule.start_time only as fallback
                        auction_start_time_ms = st.and_utc().timestamp_millis();
                    }
                }

            if let Some(auction) = state_json
                .get("auction")
                .or_else(|| state_json.get("shipment"))
            {
                // Prefer auction.auction_start_time for the bidding window
                if let Some(ast_str) = auction.get("auction_start_time").and_then(|v| v.as_str()) {
                    let st_str = ast_str.trim_end_matches('Z');
                    let parsed =
                        chrono::NaiveDateTime::parse_from_str(st_str, "%Y-%m-%dT%H:%M:%S%.f")
                            .or_else(|_| {
                                chrono::NaiveDateTime::parse_from_str(st_str, "%Y-%m-%dT%H:%M:%S")
                            });
                    if let Ok(st) = parsed {
                        auction_start_time_ms = st.and_utc().timestamp_millis();
                    }
                }

                if let Some(price) = auction.get("starting_price").and_then(|p| p.as_f64()) {
                    starting_price = Some(price);
                }

                let status = auction
                    .get("status")
                    .and_then(|st| st.as_str())
                    .unwrap_or("");
                if status == "Completed" {
                    is_completed = true;
                }

                if let Some(end_time_str) =
                    auction.get("auction_end_time").and_then(|st| st.as_str())
                {
                    let et_str = end_time_str.trim_end_matches('Z');
                    let end_time =
                        chrono::NaiveDateTime::parse_from_str(et_str, "%Y-%m-%dT%H:%M:%S%.f")
                            .or_else(|_| {
                                chrono::NaiveDateTime::parse_from_str(et_str, "%Y-%m-%dT%H:%M:%S")
                            });
                    if let Ok(et) = end_time {
                        auction_end_time_ms = et.and_utc().timestamp_millis();
                        let now = chrono::Utc::now().naive_utc();
                        if now >= et {
                            is_completed = true;
                        }
                    }
                }
            }
            if let Some(config) = state_json.get("config").or_else(|| {
                state_json
                    .get("auction")
                    .filter(|value| value.get("auction_type").is_some())
            }) {
                auction_type = config
                    .get("auction_type")
                    .and_then(|value| value.as_str())
                    .unwrap_or("REVERSE")
                    .to_ascii_uppercase();
                minimum_bid_step = config
                    .get("minimum_bid_step")
                    .and_then(|value| value.as_f64())
                    .filter(|value| value.is_finite() && *value > 0.0)
                    .unwrap_or(1.0);
            }
            let winner_data = state_json.get("winner").cloned();

            println!(
                "[ws-server] auction={} start_ms={} end_ms={} is_completed={} is_participant_check_pending",
                auction_id, auction_start_time_ms, auction_end_time_ms, is_completed
            );

            Ok(AuctionValidationResult {
                is_completed,
                join_expired,
                auction_start_time_ms,
                auction_end_time_ms,
                starting_price,
                auction_type,
                minimum_bid_step,
                winner_data,
            })
        } else {
            Err("Failed to parse auction state".to_string())
        }
    } else {
        Err("Auction has ended or does not exist".to_string())
    }
}
