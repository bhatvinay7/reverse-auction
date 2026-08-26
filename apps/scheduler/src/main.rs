use db::models::{AuctionSchedule, ScheduleState};
use db::schema::auction_schedules::dsl::*;
use diesel::prelude::*;
use std::time::Duration;
use tokio::time::sleep;

fn redis_ttl_seconds(end_time: chrono::NaiveDateTime, now: chrono::NaiveDateTime) -> u64 {
    let seconds_with_buffer = (end_time - now).num_seconds() + 300;
    std::cmp::max(3_600, seconds_with_buffer) as u64
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let _telemetry = auction_observability::init_telemetry("scheduler")?;
    if let Err(error) = run().await {
        auction_observability::report_error(
            "scheduler",
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

    let redis_pool = auction_redis::get_redis_pool()
        .await
        .map_err(|e| format!("Failed to create Redis pool: {}", e))?;

    println!("Scheduler server started (Consistent Hash Queue mode).");

    loop {
        match pool.get() {
            Ok(mut db_conn) => {
                let now = chrono::Utc::now().naive_utc();

                // Lock updates to avoid multiple workers picking up the same schedule
                let locked_schedules: QueryResult<Vec<AuctionSchedule>> = diesel::update(
                    auction_schedules
                        .filter(start_time.le(now))
                        .filter(state.eq(ScheduleState::Scheduled)),
                )
                .set(state.eq(ScheduleState::Started))
                .get_results(&mut db_conn);

                match locked_schedules {
                    Ok(schedules) => {
                        if !schedules.is_empty() {
                            println!(
                                "Scheduler found {} auctions ready to start.",
                                schedules.len()
                            );
                        }
                        for schedule in schedules {
                            println!(
                                "Processing schedule {} for auction {}",
                                schedule.id, schedule.auction_id
                            );

                            let participants = match db::schema::auction_participants::table
                                .filter(
                                    db::schema::auction_participants::auction_id
                                        .eq(schedule.auction_id),
                                )
                                .select(db::schema::auction_participants::user_id)
                                .load::<uuid::Uuid>(&mut db_conn)
                            {
                                Ok(participants) => participants,
                                Err(error) => {
                                    auction_observability::report_error(
                                        "scheduler",
                                        "participant_query",
                                        error.to_string(),
                                        serde_json::json!({"auction_id": schedule.auction_id}),
                                    );
                                    continue;
                                }
                            };

                            println!(
                                "Found {} participants for auction {}",
                                participants.len(),
                                schedule.auction_id
                            );

                            if participants.is_empty() {
                                println!(
                                    "No participants for auction {}, skipping schedule.",
                                    schedule.auction_id
                                );
                                let _ =
                                    diesel::update(auction_schedules.filter(id.eq(schedule.id)))
                                        .set(state.eq(ScheduleState::Success))
                                        .execute(&mut db_conn);
                                continue;
                            }

                            let end_time: chrono::NaiveDateTime = match db::schema::auctions::table
                                .filter(db::schema::auctions::id.eq(schedule.auction_id))
                                .select(db::schema::auctions::auction_end_time)
                                .first(&mut db_conn)
                            {
                                Ok(end_time) => end_time,
                                Err(error) => {
                                    auction_observability::report_error(
                                        "scheduler",
                                        "auction_end_time_query",
                                        error.to_string(),
                                        serde_json::json!({"auction_id": schedule.auction_id}),
                                    );
                                    continue;
                                }
                            };

                            let ttl = redis_ttl_seconds(end_time, now);

                            let auction_record = db::schema::auctions::table
                                .filter(db::schema::auctions::id.eq(schedule.auction_id))
                                .select(db::models::Auction::as_select())
                                .first(&mut db_conn);

                            let auction_record = match auction_record {
                                Ok(s) => s,
                                Err(e) => {
                                    auction_observability::report_error(
                                        "scheduler",
                                        "auction_query",
                                        e.to_string(),
                                        serde_json::json!({"auction_id": schedule.auction_id}),
                                    );
                                    continue;
                                }
                            };
                            let auction_config = db::schema::auction_configs::table
                                .filter(
                                    db::schema::auction_configs::auction_id.eq(schedule.auction_id),
                                )
                                .select(db::models::AuctionConfig::as_select())
                                .first(&mut db_conn)
                                .optional();
                            let auction_config = match auction_config {
                                Ok(config) => config,
                                Err(error) => {
                                    auction_observability::report_error(
                                        "scheduler",
                                        "auction_config_query",
                                        error.to_string(),
                                        serde_json::json!({"auction_id": schedule.auction_id}),
                                    );
                                    continue;
                                }
                            };
                            let config_data = auction_config
                                .and_then(|config| serde_json::to_value(config).ok())
                                .unwrap_or_else(|| {
                                    serde_json::json!({
                                        "auction_id": schedule.auction_id,
                                        "auction_type": "REVERSE",
                                        "minimum_bid_step": 1.0,
                                        "reserve_price": null,
                                    })
                                });

                            let auction_id_str = schedule.auction_id.to_string();

                            let mut redis_conn = match redis_pool.get().await {
                                Ok(c) => c,
                                Err(e) => {
                                    auction_observability::report_error(
                                        "scheduler",
                                        "redis_pool",
                                        e.to_string(),
                                        serde_json::json!({"auction_id": schedule.auction_id}),
                                    );
                                    let _ = diesel::update(
                                        auction_schedules.filter(id.eq(schedule.id)),
                                    )
                                    .set((
                                        state.eq(ScheduleState::Scheduled),
                                        retry_count.eq(schedule.retry_count + 1),
                                    ))
                                    .execute(&mut db_conn);
                                    continue;
                                }
                            };

                            let state_key =
                                auction_redis::format_auction_state_key(&auction_id_str);
                            let bitmap_key =
                                auction_redis::format_participants_key(&auction_id_str);
                            let timestamp = schedule.start_time.and_utc().timestamp();

                            let state_payload = serde_json::json!({
                                "schema_version": 2,
                                "schedule": schedule,
                                "auction": auction_record,
                                "config": config_data,
                                "ttl": ttl,
                            })
                            .to_string();

                            let mut redis_pipe = redis::pipe();
                            redis_pipe.atomic();

                            redis_pipe
                                .set_ex(&state_key, &state_payload, ttl as u64)
                                .ignore();
                            redis_pipe
                                .hset(
                                    auction_redis::AUCTION_STATE_HASH_KEY,
                                    &auction_id_str,
                                    &state_payload,
                                )
                                .ignore();
                            redis_pipe
                                .hset(
                                    auction_redis::AUCTION_INITIALIZED_HASH_KEY,
                                    &auction_id_str,
                                    "1",
                                )
                                .ignore();
                            redis_pipe
                                .zadd(
                                    auction_redis::AUCTION_SCHEDULE_ZSET_KEY,
                                    &auction_id_str,
                                    timestamp,
                                )
                                .ignore();

                            for user_uuid in participants {
                                let offset = (user_uuid.as_u128() % (1 << 31)) as u32;
                                redis_pipe
                                    .setbit(&bitmap_key, offset as usize, true)
                                    .ignore();
                            }
                            redis_pipe.expire(&bitmap_key, ttl as i64).ignore();

                            let redis_res: redis::RedisResult<()> =
                                redis_pipe.query_async(&mut *redis_conn).await;
                            if let Err(e) = redis_res {
                                auction_observability::report_error(
                                    "scheduler",
                                    "redis_hydration",
                                    e.to_string(),
                                    serde_json::json!({
                                        "auction_id": schedule.auction_id,
                                        "schedule_id": schedule.id,
                                        "will_retry": true,
                                    }),
                                );
                                let _ =
                                    diesel::update(auction_schedules.filter(id.eq(schedule.id)))
                                        .set((
                                            state.eq(ScheduleState::Scheduled),
                                            retry_count.eq(schedule.retry_count + 1),
                                        ))
                                        .execute(&mut db_conn);
                                continue;
                            }

                            // Mark schedule success in DB
                            let _ = diesel::update(auction_schedules.filter(id.eq(schedule.id)))
                                .set(state.eq(ScheduleState::Success))
                                .execute(&mut db_conn);

                            println!(
                                "Successfully scheduled auction {} state in Redis.",
                                auction_id_str
                            );
                        }
                    }
                    Err(e) => {
                        auction_observability::report_error(
                            "scheduler",
                            "schedule_claim",
                            e.to_string(),
                            serde_json::json!({}),
                        );
                    }
                }
            }
            Err(error) => auction_observability::report_error(
                "scheduler",
                "database_pool",
                error.to_string(),
                serde_json::json!({}),
            ),
        }

        sleep(Duration::from_secs(5)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::redis_ttl_seconds;

    #[test]
    fn ttl_has_a_one_hour_floor() {
        let now = chrono::Utc::now().naive_utc();
        assert_eq!(
            redis_ttl_seconds(now + chrono::Duration::minutes(15), now),
            3_600
        );
    }

    #[test]
    fn ttl_includes_the_recovery_buffer_for_long_auctions() {
        let now = chrono::Utc::now().naive_utc();
        assert_eq!(
            redis_ttl_seconds(now + chrono::Duration::hours(2), now),
            7_500
        );
    }
}
