use futures_util::stream::StreamExt;
use rdkafka::{
    Message, Offset, TopicPartitionList,
    consumer::{CommitMode, Consumer, StreamConsumer},
    producer::FutureProducer,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
struct NotificationPayload {
    pub event_type: Option<String>,
    pub auction_id: Option<String>,
    pub email: Option<String>,
    pub message: String,
    #[serde(default)]
    pub retry_count: i32,
}

#[derive(Deserialize, Debug)]
struct BidDecisionPayload {
    request_id: String,
    bid: AuditedBidPayload,
    auction_type: db::models::AuctionType,
    is_executed: bool,
    rejection_reason: Option<String>,
    previous_price: f64,
    resulting_price: f64,
    processed_at: i64,
    source_topic: String,
    source_partition: i32,
    source_offset: i64,
}

#[derive(Deserialize, Debug)]
struct AuditedBidPayload {
    auction_id: uuid::Uuid,
    bidder_id: String,
    username: Option<String>,
    amount: f64,
    timestamp: i64,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let _telemetry = auction_observability::init_telemetry("notification-worker")?;
    if let Err(error) = run().await {
        auction_observability::report_error(
            "notification-worker",
            "service_exit",
            error.to_string(),
            serde_json::json!({"fatal": true}),
        );
        return Err(error);
    }
    Ok(())
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let pool = db::get_connection_pool();
    wait_for_topics().await;
    let producer = auction_kafka::producer()?;
    let notification_consumer = auction_kafka::consumer(
        auction_kafka::NOTIFICATION_GROUP,
        &[auction_kafka::NOTIFICATION_TOPIC],
    )?;
    let sync_consumer =
        auction_kafka::consumer(auction_kafka::SYNC_GROUP, &[auction_kafka::SYNC_TOPIC])?;
    let audit_consumer = auction_kafka::consumer(
        auction_kafka::BID_AUDIT_GROUP,
        &[auction_kafka::BID_DECISION_TOPIC],
    )?;

    tokio::spawn(run_bid_audit_worker(
        pool.clone(),
        audit_consumer,
        producer.clone(),
    ));
    tokio::spawn(run_sync_worker(
        pool.clone(),
        sync_consumer,
        producer.clone(),
    ));
    tokio::spawn(run_sweep_worker(pool.clone(), producer.clone()));
    println!("[notification-worker] Kafka consumers started");
    run_notification_worker(pool, notification_consumer, producer).await;
    Ok(())
}

async fn run_bid_audit_worker(
    pool: diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<diesel::PgConnection>>,
    consumer: StreamConsumer,
    producer: FutureProducer,
) {
    use diesel::prelude::*;

    println!(
        "[bid-audit-worker] Consuming from '{}'",
        auction_kafka::BID_DECISION_TOPIC
    );
    let mut stream = consumer.stream();
    while let Some(result) = stream.next().await {
        let message = match result {
            Ok(message) => message,
            Err(error) => {
                auction_observability::report_error(
                    "notification-worker",
                    "audit_kafka_receive",
                    error.to_string(),
                    serde_json::json!({"worker": "bid-audit"}),
                );
                continue;
            }
        };

        let event = match serde_json::from_slice::<BidDecisionPayload>(
            message.payload().unwrap_or_default(),
        )
        .map_err(|error| format!("invalid decision JSON: {error}"))
        .and_then(to_new_bid_audit_event)
        {
            Ok(event) => event,
            Err(error) => {
                auction_observability::report_error(
                    "notification-worker",
                    "malformed_bid_decision",
                    error.clone(),
                    serde_json::json!({
                        "partition": message.partition(),
                        "offset": message.offset(),
                    }),
                );
                let reason = format!("MALFORMED_BID_DECISION:{error}");
                let mut delay = 1_u64;
                while !publish_dlq(&producer, &message, &reason).await {
                    tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
                    delay = (delay * 2).min(30);
                }
                commit(&consumer, &message);
                continue;
            }
        };

        let mut attempts = 0_u32;
        loop {
            attempts = attempts.saturating_add(1);
            let result =
                pool.get()
                    .map_err(|error| error.to_string())
                    .and_then(|mut connection| {
                        diesel::insert_into(db::schema::bid_audit_events::table)
                            .values(&event)
                            .on_conflict(db::schema::bid_audit_events::request_id)
                            .do_nothing()
                            .execute(&mut connection)
                            .map(|_| ())
                            .map_err(|error| error.to_string())
                    });
            match result {
                Ok(()) => break,
                Err(error) => {
                    auction_observability::report_error(
                        "notification-worker",
                        "audit_database_write",
                        error,
                        serde_json::json!({
                            "request_id": event.request_id,
                            "attempt": attempts,
                        }),
                    );
                    let delay = (attempts as u64 * 2).min(30);
                    tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
                }
            }
        }

        // Never commit a well-formed decision before PostgreSQL acknowledges
        // it. Database outages therefore create lag instead of an audit gap.
        commit(&consumer, &message);
    }
}

fn to_new_bid_audit_event(
    payload: BidDecisionPayload,
) -> Result<db::models::NewBidAuditEvent, String> {
    use chrono::{DateTime, Utc};

    let request_id = uuid::Uuid::parse_str(&payload.request_id)
        .map_err(|error| format!("invalid request_id: {error}"))?;
    let bidder_id = uuid::Uuid::parse_str(&payload.bid.bidder_id)
        .map_err(|error| format!("invalid bidder_id: {error}"))?;
    if !payload.bid.amount.is_finite() || payload.bid.amount <= 0.0 {
        return Err("amount must be finite and greater than zero".to_string());
    }
    if !payload.previous_price.is_finite() || !payload.resulting_price.is_finite() {
        return Err("decision prices must be finite".to_string());
    }
    if payload.source_topic != auction_kafka::BID_TOPIC
        || payload.source_partition < 0
        || payload.source_offset < 0
    {
        return Err("invalid source Kafka position".to_string());
    }
    if !payload.is_executed && payload.rejection_reason.is_none() {
        return Err("rejected decision is missing rejection_reason".to_string());
    }
    let submitted_at = DateTime::<Utc>::from_timestamp_millis(payload.bid.timestamp)
        .ok_or_else(|| "invalid bid timestamp".to_string())?
        .naive_utc();
    let processed_at = DateTime::<Utc>::from_timestamp_millis(payload.processed_at)
        .ok_or_else(|| "invalid processed_at timestamp".to_string())?
        .naive_utc();

    Ok(db::models::NewBidAuditEvent {
        request_id,
        auction_id: payload.bid.auction_id,
        bidder_id,
        username: payload.bid.username,
        amount: payload.bid.amount,
        auction_type: payload.auction_type,
        accepted: payload.is_executed,
        rejection_reason: payload.rejection_reason,
        previous_price: payload.previous_price,
        resulting_price: payload.resulting_price,
        submitted_at,
        processed_at,
        source_topic: payload.source_topic,
        source_partition: payload.source_partition,
        source_offset: payload.source_offset,
    })
}

#[cfg(test)]
mod bid_audit_tests {
    use super::{AuditedBidPayload, BidDecisionPayload, to_new_bid_audit_event};

    fn decision(accepted: bool) -> BidDecisionPayload {
        BidDecisionPayload {
            request_id: uuid::Uuid::new_v4().to_string(),
            bid: AuditedBidPayload {
                auction_id: uuid::Uuid::new_v4(),
                bidder_id: uuid::Uuid::new_v4().to_string(),
                username: Some("audited bidder".to_string()),
                amount: 95.0,
                timestamp: 1_787_654_321_000,
            },
            auction_type: db::models::AuctionType::Reverse,
            is_executed: accepted,
            rejection_reason: (!accepted).then(|| "BID_DOES_NOT_IMPROVE_PRICE".to_string()),
            previous_price: 100.0,
            resulting_price: if accepted { 95.0 } else { 100.0 },
            processed_at: 1_787_654_321_010,
            source_topic: auction_kafka::BID_TOPIC.to_string(),
            source_partition: 3,
            source_offset: 42,
        }
    }

    #[test]
    fn accepted_and_rejected_decisions_convert_to_audit_rows() {
        let accepted = to_new_bid_audit_event(decision(true)).unwrap();
        assert!(accepted.accepted);
        assert!(accepted.rejection_reason.is_none());

        let rejected = to_new_bid_audit_event(decision(false)).unwrap();
        assert!(!rejected.accepted);
        assert_eq!(
            rejected.rejection_reason.as_deref(),
            Some("BID_DOES_NOT_IMPROVE_PRICE")
        );
    }

    #[test]
    fn rejected_decision_requires_a_reason() {
        let mut payload = decision(false);
        payload.rejection_reason = None;
        assert!(to_new_bid_audit_event(payload).is_err());
    }
}

async fn run_notification_worker(
    pool: diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<diesel::PgConnection>>,
    consumer: StreamConsumer,
    producer: FutureProducer,
) {
    let mut stream = consumer.stream();
    while let Some(result) = stream.next().await {
        let message = match result {
            Ok(message) => message,
            Err(error) => {
                auction_observability::report_error(
                    "notification-worker",
                    "notification_kafka_receive",
                    error.to_string(),
                    serde_json::json!({"worker": "notification"}),
                );
                continue;
            }
        };
        match serde_json::from_slice::<NotificationPayload>(message.payload().unwrap_or_default()) {
            Ok(mut payload) => {
                use db::schema::{auction_participants, users};
                use diesel::prelude::*;
                use uuid::Uuid;

                let mut all_sent = true;

                if payload.event_type.as_deref() == Some("user_signup") {
                    if let Some(email) = &payload.email {
                        let email_sent = simulate_send_email(email, &payload).await;
                        if email_sent {
                            println!("Successfully sent signup email to {}", email);
                        } else {
                            all_sent = false;
                        }
                    }
                } else {
                    let mut db_conn = match pool.get() {
                        Ok(conn) => conn,
                        Err(e) => {
                            auction_observability::report_error(
                                "notification-worker",
                                "notification_database_pool",
                                e.to_string(),
                                serde_json::json!({}),
                            );
                            continue;
                        }
                    };
                    let auction_uuid =
                        Uuid::parse_str(&payload.auction_id.clone().unwrap_or_default())
                            .unwrap_or_default();

                    // Fetch auction details to build a personalized message
                    use db::models::{Auction, AuctionSchedule};
                    use db::schema::{auction_schedules, auctions};

                    let auction = auctions::table
                        .filter(auctions::id.eq(auction_uuid))
                        .select(Auction::as_select())
                        .first(&mut db_conn);

                    let schedule = auction_schedules::table
                        .filter(auction_schedules::auction_id.eq(auction_uuid))
                        .select(AuctionSchedule::as_select())
                        .first(&mut db_conn);

                    if let (Ok(s), Ok(sch)) = (auction, schedule) {
                        payload.message = format!(
                            "<html>
                               <body style=\"font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;\">
                                 <div style=\"max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);\">
                                   <h2 style=\"color: #4f46e5; margin-bottom: 20px;\">Auction Started: {}</h2>
                                   <p style=\"color: #3f3f46; font-size: 16px; line-height: 1.5;\">
                                     The auction for <strong>{}</strong> is now officially active.
                                   </p>
                                   <div style=\"background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;\">
                                     <p style=\"margin: 5px 0; color: #475569;\"><strong>Origin:</strong> {}</p>
                                     <p style=\"margin: 5px 0; color: #475569;\"><strong>Destination:</strong> {}</p>
                                     <p style=\"margin: 5px 0; color: #475569;\"><strong>Scheduled Start:</strong> {}</p>
                                   </div>
                                   <a href=\"http://localhost:3000/auction/{}\" style=\"display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 16px;\">
                                     View Bidding Console
                                   </a>
                                 </div>
                               </body>
                             </html>",
                            s.title,
                            s.title,
                            s.origin_address.as_deref().unwrap_or("Not specified"),
                            s.dest_address.as_deref().unwrap_or("Not specified"),
                            sch.start_time,
                            s.id
                        );
                    }

                    // Fetch participants emails
                    let participant_emails: Vec<String> = auction_participants::table
                        .filter(auction_participants::auction_id.eq(auction_uuid))
                        .inner_join(users::table)
                        .select(users::email)
                        .load::<String>(&mut db_conn)
                        .unwrap_or_default();

                    if participant_emails.is_empty() {
                        println!(
                            "No participants found for auction {:?}. Marking as sent.",
                            payload.auction_id
                        );
                    } else {
                        for email in &participant_emails {
                            let email_sent = simulate_send_email(email, &payload).await;
                            if email_sent {
                                println!("Successfully sent email to {}", email);
                            } else {
                                all_sent = false;
                            }
                        }
                    }
                }

                if all_sent {
                    commit(&consumer, &message);
                } else if payload.retry_count >= 3 {
                    println!(
                        "Max retries reached for {:?}, pushed to DLQ",
                        payload
                            .auction_id
                            .clone()
                            .unwrap_or_else(|| payload.email.clone().unwrap_or_default())
                    );
                    if let Ok(dlq_payload) = serde_json::to_vec(&payload) {
                        let key = payload
                            .auction_id
                            .as_deref()
                            .or(payload.email.as_deref())
                            .unwrap_or("notification");
                        if auction_kafka::publish(
                            &producer,
                            auction_kafka::DLQ_TOPIC,
                            key,
                            &dlq_payload,
                        )
                        .await
                        .is_ok()
                        {
                            commit(&consumer, &message);
                        }
                    }
                } else {
                    payload.retry_count += 1;
                    if let Ok(retry_payload) = serde_json::to_vec(&payload) {
                        let key = payload
                            .auction_id
                            .as_deref()
                            .or(payload.email.as_deref())
                            .unwrap_or("notification");
                        match auction_kafka::publish(
                            &producer,
                            auction_kafka::NOTIFICATION_TOPIC,
                            key,
                            &retry_payload,
                        )
                        .await
                        {
                            Ok(_) => commit(&consumer, &message),
                            Err(error) => auction_observability::report_error(
                                "notification-worker",
                                "notification_retry_publish",
                                error,
                                serde_json::json!({"retry_count": payload.retry_count}),
                            ),
                        }
                    }
                }
            }
            Err(error) => {
                auction_observability::report_error(
                    "notification-worker",
                    "malformed_notification",
                    error.to_string(),
                    serde_json::json!({
                        "partition": message.partition(),
                        "offset": message.offset(),
                    }),
                );
                if publish_dlq(
                    &producer,
                    &message,
                    &format!("MALFORMED_NOTIFICATION:{error}"),
                )
                .await
                {
                    commit(&consumer, &message);
                }
            }
        }
    }
}

async fn run_sync_worker(
    pool: diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<diesel::PgConnection>>,
    consumer: StreamConsumer,
    producer: FutureProducer,
) {
    use chrono::{DateTime, Utc};
    use db::models::NewBid;
    use db::schema::bids;
    use diesel::prelude::*;
    use uuid::Uuid;

    println!(
        "[sync-worker] Consuming from '{}'",
        auction_kafka::SYNC_TOPIC
    );

    let redis_pool = match auction_redis::get_redis_pool().await {
        Ok(p) => p,
        Err(e) => {
            auction_observability::report_error(
                "notification-worker",
                "sync_redis_pool",
                e.to_string(),
                serde_json::json!({"worker": "sync"}),
            );
            return;
        }
    };

    let mut stream = consumer.stream();
    while let Some(result) = stream.next().await {
        let message = match result {
            Ok(message) => message,
            Err(e) => {
                auction_observability::report_error(
                    "notification-worker",
                    "sync_kafka_receive",
                    e.to_string(),
                    serde_json::json!({"worker": "sync"}),
                );
                continue;
            }
        };

        // Parse payload: { "auction_id": "<uuid>" }
        let payload_val: serde_json::Value =
            match serde_json::from_slice(message.payload().unwrap_or_default()) {
                Ok(v) => v,
                Err(e) => {
                    auction_observability::report_error(
                        "notification-worker",
                        "malformed_sync",
                        e.to_string(),
                        serde_json::json!({
                            "partition": message.partition(),
                            "offset": message.offset(),
                        }),
                    );
                    if publish_dlq(&producer, &message, &format!("MALFORMED_SYNC:{e}")).await {
                        commit(&consumer, &message);
                    }
                    continue;
                }
            };

        let auction_id_str = match payload_val.get("auction_id").and_then(|v| v.as_str()) {
            Some(s) => s.to_string(),
            None => {
                auction_observability::report_error(
                    "notification-worker",
                    "sync_missing_auction_id",
                    "sync record is missing auction_id",
                    serde_json::json!({
                        "partition": message.partition(),
                        "offset": message.offset(),
                    }),
                );
                if publish_dlq(&producer, &message, "SYNC_MISSING_AUCTION_ID").await {
                    commit(&consumer, &message);
                }
                continue;
            }
        };

        let auction_uuid = match Uuid::parse_str(&auction_id_str) {
            Ok(u) => u,
            Err(_) => {
                auction_observability::report_error(
                    "notification-worker",
                    "sync_invalid_auction_id",
                    "sync record contains an invalid auction UUID",
                    serde_json::json!({"auction_id": auction_id_str}),
                );
                if publish_dlq(&producer, &message, "SYNC_INVALID_AUCTION_ID").await {
                    commit(&consumer, &message);
                }
                continue;
            }
        };

        println!("[sync-worker] Syncing auction {} to DB", auction_id_str);

        // Retry loop with backoff — sends to DLQ after 3 failures
        let mut attempts = 0u32;
        let success = loop {
            attempts += 1;

            let mut con = match redis_pool.get().await {
                Ok(c) => c,
                Err(e) => {
                    auction_observability::report_error(
                        "notification-worker",
                        "sync_redis_pool",
                        e.to_string(),
                        serde_json::json!({
                            "auction_id": auction_id_str,
                            "attempt": attempts,
                        }),
                    );
                    if attempts >= 3 {
                        break false;
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(attempts as u64 * 2)).await;
                    continue;
                }
            };
            let mut db_conn = match pool.get() {
                Ok(c) => c,
                Err(e) => {
                    auction_observability::report_error(
                        "notification-worker",
                        "sync_database_pool",
                        e.to_string(),
                        serde_json::json!({
                            "auction_id": auction_id_str,
                            "attempt": attempts,
                        }),
                    );
                    if attempts >= 3 {
                        break false;
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(attempts as u64 * 2)).await;
                    continue;
                }
            };

            let (auction_type, reserve_price) = db::schema::auction_configs::table
                .filter(db::schema::auction_configs::auction_id.eq(auction_uuid))
                .select((
                    db::schema::auction_configs::auction_type,
                    db::schema::auction_configs::reserve_price,
                ))
                .first::<(db::models::AuctionType, Option<f64>)>(&mut db_conn)
                .unwrap_or((db::models::AuctionType::Reverse, None));

            // 1. Fetch accepted bids from the auction ZSET.
            use redis::AsyncCommands;
            let zset_key = auction_redis::format_zset_key(&auction_id_str);
            let live_stream = auction_redis::format_live_stream(&auction_id_str);
            let sync_stream = auction_redis::format_sync_stream(&auction_id_str);

            let bids_data: Vec<String> = match (*con).zrange(&zset_key, 0, -1).await {
                Ok(d) => d,
                Err(e) => {
                    auction_observability::report_error(
                        "notification-worker",
                        "sync_bid_read",
                        e.to_string(),
                        serde_json::json!({
                            "auction_id": auction_id_str,
                            "attempt": attempts,
                        }),
                    );
                    if attempts >= 3 {
                        break false;
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(attempts as u64 * 2)).await;
                    continue;
                }
            };

            // 2. Parse bids from JSON to determine the winner and prepare DB insertion
            let mut new_bids: Vec<NewBid> = Vec::new();
            let mut winner: Option<(Uuid, f64)> = None;
            for bid_str in bids_data.into_iter() {
                let parsed = match serde_json::from_str::<serde_json::Value>(&bid_str) {
                    Ok(p) => p,
                    Err(e) => {
                        auction_observability::report_error(
                            "notification-worker",
                            "stored_bid_malformed",
                            e.to_string(),
                            serde_json::json!({"auction_id": auction_id_str}),
                        );
                        continue;
                    }
                };

                if !parsed["is_executed"].as_bool().unwrap_or(false) {
                    continue;
                }

                let bid_obj = &parsed["bid"];
                let amount = bid_obj["amount"].as_f64().unwrap_or(0.0);
                let timestamp = bid_obj["timestamp"].as_i64().unwrap_or(0);

                let bidder_id_str = bid_obj["bidder_id"].as_str().unwrap_or("");
                let carrier_id = match Uuid::parse_str(bidder_id_str) {
                    Ok(u) => u,
                    Err(_) => {
                        auction_observability::report_error(
                            "notification-worker",
                            "stored_bid_invalid_bidder",
                            "stored accepted bid has an invalid bidder UUID",
                            serde_json::json!({
                                "auction_id": auction_id_str,
                                "bidder_id": bidder_id_str,
                            }),
                        );
                        continue;
                    }
                };

                let dt = match DateTime::<Utc>::from_timestamp_millis(timestamp) {
                    Some(d) => d.naive_utc(),
                    None => {
                        auction_observability::report_error(
                            "notification-worker",
                            "stored_bid_invalid_timestamp",
                            "stored accepted bid has an invalid timestamp",
                            serde_json::json!({
                                "auction_id": auction_id_str,
                                "timestamp": timestamp,
                            }),
                        );
                        continue;
                    }
                };

                let is_better = winner.is_none_or(|(_, current_amount)| match auction_type {
                    db::models::AuctionType::Reverse => amount < current_amount,
                    db::models::AuctionType::Forward => amount > current_amount,
                });
                if is_better {
                    winner = Some((carrier_id, amount));
                }

                let request_id = match parsed["request_id"]
                    .as_str()
                    .and_then(|value| Uuid::parse_str(value).ok())
                {
                    Some(id) => id,
                    None => {
                        auction_observability::report_error(
                            "notification-worker",
                            "stored_bid_invalid_request_id",
                            "stored accepted bid has an invalid request UUID",
                            serde_json::json!({"auction_id": auction_id_str}),
                        );
                        continue;
                    }
                };

                new_bids.push(NewBid {
                    id: request_id,
                    amount,
                    created_at: dt,
                    carrier_id,
                    auction_id: auction_uuid,
                });
            }

            let winner_id = winner
                .filter(|(_, amount)| {
                    auction_type == db::models::AuctionType::Reverse
                        || reserve_price.is_none_or(|reserve| *amount >= reserve)
                })
                .map(|(bidder_id, _)| bidder_id);

            // 3. Update auction status and winner_id.
            let query_res = match winner_id {
                Some(w_id) => {
                    diesel::sql_query("UPDATE auctions SET status = 'COMPLETED'::auction_status, winner_id = $2 WHERE id = $1")
                        .bind::<diesel::sql_types::Uuid, _>(auction_uuid)
                        .bind::<diesel::sql_types::Uuid, _>(w_id)
                        .execute(&mut db_conn)
                },
                None => {
                    diesel::sql_query("UPDATE auctions SET status = 'COMPLETED'::auction_status WHERE id = $1")
                        .bind::<diesel::sql_types::Uuid, _>(auction_uuid)
                        .execute(&mut db_conn)
                }
            };

            if let Err(e) = query_res {
                auction_observability::report_error(
                    "notification-worker",
                    "sync_auction_update",
                    e.to_string(),
                    serde_json::json!({
                        "auction_id": auction_id_str,
                        "attempt": attempts,
                    }),
                );
                if attempts >= 3 {
                    break false;
                }
                tokio::time::sleep(std::time::Duration::from_secs(attempts as u64 * 2)).await;
                continue;
            }

            if !new_bids.is_empty() {
                if let Err(e) = diesel::insert_into(bids::table)
                    .values(&new_bids)
                    .on_conflict_do_nothing()
                    .execute(&mut db_conn)
                {
                    auction_observability::report_error(
                        "notification-worker",
                        "sync_bid_insert",
                        e.to_string(),
                        serde_json::json!({
                            "auction_id": auction_id_str,
                            "attempt": attempts,
                            "bid_count": new_bids.len(),
                        }),
                    );
                    if attempts >= 3 {
                        break false;
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(attempts as u64 * 2)).await;
                    continue;
                }
            }

            // 4. Atomically delete all per-auction Redis artifacts.
            //    Redis DEL / HDEL / ZREM on non-existent keys always return 0 — never an error.
            //    This is safe for zero-bid auctions where the ZSET and streams may never have been created.
            let del_res: redis::RedisResult<()> = redis::pipe()
                .atomic()
                // Per-auction volatile keys (ZSET + streams)
                .del(&zset_key) // auction:zset:low_bids:{id}
                .del(&live_stream) // auction:stream:live:{id}
                .del(&sync_stream) // auction:stream:sync:{id}
                .del(auction_redis::format_bid_request_stream(&auction_id_str)) // auction:bid_request:{id}
                // Remove from global hashes/zsets
                .hdel(auction_redis::AUCTION_STATE_HASH_KEY, &auction_id_str) // auction:states
                .hdel(auction_redis::AUCTION_INITIALIZED_HASH_KEY, &auction_id_str) // auction:initialized_hash
                .zrem(auction_redis::AUCTION_SCHEDULE_ZSET_KEY, &auction_id_str) // auction:schedule_zset
                // Participants bitmap (auction:participants:{id})
                .del(format!(
                    "{}:{}",
                    auction_redis::AUCTION_PARTICIPANTS_PREFIX,
                    &auction_id_str
                ))
                .query_async(&mut *con)
                .await;

            if let Err(e) = del_res {
                auction_observability::report_error(
                    "notification-worker",
                    "sync_redis_cleanup",
                    e.to_string(),
                    serde_json::json!({
                        "auction_id": auction_id_str,
                        "fatal": false,
                    }),
                );
            } else {
                println!(
                    "[sync-worker] Redis artifacts cleaned up for auction {}.",
                    auction_id_str
                );
            }

            println!(
                "[sync-worker] Auction {} synced successfully.",
                auction_id_str
            );
            break true;
        };

        if success {
            commit(&consumer, &message);
        } else {
            auction_observability::report_error(
                "notification-worker",
                "sync_retries_exhausted",
                "auction finalization retries exhausted",
                serde_json::json!({"auction_id": auction_id_str}),
            );
            if publish_dlq(&producer, &message, "SYNC_RETRIES_EXHAUSTED").await {
                commit(&consumer, &message);
            }
        }
    }
}

/// Polls Postgres every 60 seconds for auctions that have ended but were never
/// finalized (status != 'COMPLETED'). This covers the zero-bid scenario and any
/// case where the auction-engine was down when the timer fired.
///
/// It re-publishes the auction_id to the Kafka sync topic. The sync_worker
/// already handles idempotency: once it sets status = 'COMPLETED', this query
/// will no longer return that auction.
async fn run_sweep_worker(
    pool: diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<diesel::PgConnection>>,
    producer: FutureProducer,
) {
    use chrono::Utc;
    use diesel::prelude::*;

    println!("[sweep-worker] Started. Polling for missed auction finalizations every 60s.");

    loop {
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;

        // Only sweep auctions whose end_time was at least 12 seconds ago.
        // This grace period lets the auction-engine fire its own EndAuction event
        // before the sweeper treats the auction as "missed".
        let deadline = Utc::now().naive_utc() - chrono::Duration::seconds(12);

        let mut db_conn = match pool.get() {
            Ok(c) => c,
            Err(e) => {
                auction_observability::report_error(
                    "notification-worker",
                    "sweeper_database_pool",
                    e.to_string(),
                    serde_json::json!({"worker": "sweeper"}),
                );
                continue;
            }
        };

        // Find all auctions that ended (+ 12s grace) but are not yet COMPLETED.
        // We use a raw SQL query to avoid the auction_status enum needing special mapping.
        let stale_ids: Vec<uuid::Uuid> = match diesel::sql_query(
            "SELECT id FROM auctions \
             WHERE auction_end_time IS NOT NULL \
               AND auction_end_time < $1 \
               AND status != 'COMPLETED'::auction_status",
        )
        .bind::<diesel::sql_types::Timestamp, _>(deadline)
        .load::<IdRow>(&mut db_conn)
        {
            Ok(rows) => rows.into_iter().map(|r| r.id).collect(),
            Err(e) => {
                auction_observability::report_error(
                    "notification-worker",
                    "sweeper_query",
                    e.to_string(),
                    serde_json::json!({"worker": "sweeper"}),
                );
                continue;
            }
        };

        if stale_ids.is_empty() {
            continue;
        }

        println!(
            "[sweep-worker] Found {} stale auction(s) to finalize.",
            stale_ids.len()
        );

        for auction_uuid in stale_ids {
            let payload = serde_json::json!({ "auction_id": auction_uuid.to_string() }).to_string();
            match auction_kafka::publish(
                &producer,
                auction_kafka::SYNC_TOPIC,
                &auction_uuid.to_string(),
                payload.as_bytes(),
            )
            .await
            {
                Ok(_) => println!(
                    "[sweep-worker] Re-queued auction {} for sync.",
                    auction_uuid
                ),
                Err(e) => auction_observability::report_error(
                    "notification-worker",
                    "sweeper_sync_publish",
                    e,
                    serde_json::json!({"auction_id": auction_uuid}),
                ),
            }
        }
    }
}

async fn wait_for_topics() {
    let mut delay = 1_u64;
    loop {
        match auction_kafka::ensure_topics().await {
            Ok(()) => return,
            Err(error) => {
                auction_observability::report_error(
                    "notification-worker",
                    "topic_setup",
                    error,
                    serde_json::json!({"retry_in_seconds": delay}),
                );
                tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
                delay = (delay * 2).min(60);
            }
        }
    }
}

fn commit<M: Message>(consumer: &StreamConsumer, message: &M) {
    let mut offsets = TopicPartitionList::new();
    if let Err(error) = offsets.add_partition_offset(
        message.topic(),
        message.partition(),
        Offset::Offset(message.offset() + 1),
    ) {
        auction_observability::report_error(
            "notification-worker",
            "offset_commit_build",
            error.to_string(),
            serde_json::json!({
                "topic": message.topic(),
                "partition": message.partition(),
                "offset": message.offset(),
            }),
        );
        return;
    }
    if let Err(error) = consumer.commit(&offsets, CommitMode::Async) {
        auction_observability::report_error(
            "notification-worker",
            "offset_commit",
            error.to_string(),
            serde_json::json!({
                "topic": message.topic(),
                "partition": message.partition(),
                "offset": message.offset(),
            }),
        );
    }
}

async fn publish_dlq<M: Message>(producer: &FutureProducer, message: &M, reason: &str) -> bool {
    let key = message
        .key_view::<str>()
        .and_then(Result::ok)
        .unwrap_or("unknown");
    let payload = serde_json::json!({
        "source_topic": message.topic(),
        "source_partition": message.partition(),
        "source_offset": message.offset(),
        "reason": reason,
        "payload": String::from_utf8_lossy(message.payload().unwrap_or_default()),
    })
    .to_string();
    match auction_kafka::publish(producer, auction_kafka::DLQ_TOPIC, key, payload.as_bytes()).await
    {
        Ok(_) => true,
        Err(error) => {
            auction_observability::report_error(
                "notification-worker",
                "dlq_publish",
                error,
                serde_json::json!({
                    "source_topic": message.topic(),
                    "partition": message.partition(),
                    "offset": message.offset(),
                }),
            );
            false
        }
    }
}

/// Diesel queryable row for the sweep query (only needs `id`).
#[derive(diesel::QueryableByName)]
struct IdRow {
    #[diesel(sql_type = diesel::sql_types::Uuid)]
    id: uuid::Uuid,
}

async fn simulate_send_email(email_addr: &str, payload: &NotificationPayload) -> bool {
    use lettre::{
        AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
        transport::smtp::authentication::Credentials,
    };

    let smtp_user = std::env::var("SMTP_USER").unwrap_or_default();
    let smtp_pass = std::env::var("SMTP_PASS").unwrap_or_default();
    let smtp_host = std::env::var("SMTP_HOST").unwrap_or_else(|_| "smtp.gmail.com".to_string());

    if smtp_user.is_empty() || smtp_pass.is_empty() {
        println!(
            "SMTP credentials missing, skipping real email to {}",
            email_addr
        );
        return true; // Pretend it succeeded so it doesn't queue infinitely
    }

    let from_addr: lettre::message::Mailbox =
        match format!("Auction Platform <{}>", smtp_user).parse() {
            Ok(addr) => addr,
            Err(e) => {
                auction_observability::report_error(
                    "notification-worker",
                    "email_from_address",
                    e.to_string(),
                    serde_json::json!({}),
                );
                return false;
            }
        };

    let to_addr: lettre::message::Mailbox = match email_addr.parse() {
        Ok(addr) => addr,
        Err(e) => {
            auction_observability::report_error(
                "notification-worker",
                "email_to_address",
                e.to_string(),
                serde_json::json!({}),
            );
            return false;
        }
    };

    use lettre::message::header::ContentType;

    let email = match Message::builder()
        .from(from_addr)
        .to(to_addr)
        .subject(if payload.event_type.as_deref() == Some("user_signup") {
            "Welcome to Auquid Auction!"
        } else {
            "Auction Notification"
        })
        .header(ContentType::TEXT_HTML)
        .body(payload.message.clone())
    {
        Ok(m) => m,
        Err(error) => {
            auction_observability::report_error(
                "notification-worker",
                "email_build",
                error.to_string(),
                serde_json::json!({}),
            );
            return false;
        }
    };

    let creds = Credentials::new(smtp_user.clone(), smtp_pass);

    let mailer: AsyncSmtpTransport<Tokio1Executor> =
        match AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_host) {
            Ok(m) => m.credentials(creds).build(),
            Err(error) => {
                auction_observability::report_error(
                    "notification-worker",
                    "smtp_setup",
                    error.to_string(),
                    serde_json::json!({"smtp_host": smtp_host}),
                );
                return false;
            }
        };

    match mailer.send(email).await {
        Ok(_) => true,
        Err(e) => {
            auction_observability::report_error(
                "notification-worker",
                "email_send",
                e.to_string(),
                serde_json::json!({}),
            );
            false
        }
    }
}
