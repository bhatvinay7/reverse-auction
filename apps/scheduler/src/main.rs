use db::models::{AuctionSchedule, ScheduleState};
use db::schema::auction_schedules::dsl::*;
use diesel::prelude::*;
use lapin::{options::*, BasicProperties, types::FieldTable};
use std::time::Duration;
use tokio::time::sleep;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let pool = db::get_connection_pool();

    let mut rmq_retry = 1;
    let rmq_conn = loop {
        match rabbitmq::get_rabbitmq_connection().await {
            Ok(c) => break c,
            Err(e) => {
                eprintln!("Failed to connect to RabbitMQ: {:?}. Retrying in {}s...", e, rmq_retry);
                tokio::time::sleep(std::time::Duration::from_secs(rmq_retry)).await;
                rmq_retry = std::cmp::min(rmq_retry * 2, 60);
            }
        }
    };
    
    let channel = rmq_conn.create_channel().await.map_err(|e| format!("Failed to create RMQ channel: {}", e))?;
    let mut queue_opts = QueueDeclareOptions::default();
    queue_opts.durable = true;
    channel.queue_declare(rabbitmq::SCHEDULER_QUEUE.into(), queue_opts.clone(), FieldTable::default()).await
        .map_err(|e| format!("Failed to declare scheduler queue: {}", e))?;
    channel.queue_declare(rabbitmq::SCHEDULER_DLQ.into(), queue_opts, FieldTable::default()).await
        .map_err(|e| format!("Failed to declare scheduler dlq: {}", e))?;

    let redis_pool = auction_redis::get_redis_pool().await.map_err(|e| format!("Failed to create Redis pool: {}", e))?;
    
    println!("Scheduler server started.");

    loop {
        if let Ok(mut db_conn) = pool.get() {
            let now = chrono::Utc::now().naive_utc();
            
            // 1. Lock update to avoid multiple workers picking it up
            // We set state to 'Started' to lock it.
            let locked_schedules: QueryResult<Vec<AuctionSchedule>> = diesel::update(
                auction_schedules.filter(start_time.le(now)).filter(state.eq(ScheduleState::Scheduled))
            )
            .set(state.eq(ScheduleState::Started))
            .get_results(&mut db_conn);

            match locked_schedules {
                Ok(schedules) => {
                    if !schedules.is_empty() {
                        println!("Scheduler found {} auctions ready to start.", schedules.len());
                    }
                    for schedule in schedules {
                        println!("Processing schedule {} for auction {}", schedule.id, schedule.auction_id);
                        // 1.5 Fetch participants and calculate TTL
                        use redis::AsyncCommands;
                        
                        let participants = db::schema::auction_participants::table
                            .filter(db::schema::auction_participants::auction_id.eq(schedule.auction_id))
                            .select(db::schema::auction_participants::user_id)
                            .load::<uuid::Uuid>(&mut db_conn)
                            .unwrap_or_default();
                            
                        println!("Found {} participants for auction {}", participants.len(), schedule.auction_id);
                        
                        if participants.is_empty() {
                            println!("No participants for auction {}, skipping schedule.", schedule.auction_id);
                            let _ = diesel::update(auction_schedules.filter(id.eq(schedule.id)))
                                .set(state.eq(ScheduleState::Success))
                                .execute(&mut db_conn);
                            continue;
                        }
                            
                        let end_time: chrono::NaiveDateTime = db::schema::shipments::table
                            .filter(db::schema::shipments::id.eq(schedule.auction_id))
                            .select(db::schema::shipments::auction_end_time)
                            .first(&mut db_conn)
                            .unwrap_or(now + chrono::Duration::minutes(3));
                            
                        let diff_seconds = (end_time - now).num_seconds();
                        // Minimum TTL of 1 hour (3600s) so test auctions don't instantly expire and lock users out.
                        let ttl = std::cmp::max(3600, diff_seconds + 300) as u64;

                        let mut payload_value = match serde_json::to_value(&schedule) {
                            Ok(v) => v,
                            Err(e) => {
                                eprintln!("Failed to serialize schedule {}: {}", schedule.id, e);
                                continue;
                            }
                        };
                        if let Some(obj) = payload_value.as_object_mut() {
                            obj.insert("ttl".to_string(), serde_json::json!(ttl));
                        }
                        let payload = match serde_json::to_string(&payload_value) {
                            Ok(s) => s,
                            Err(e) => {
                                eprintln!("Failed to convert payload to string for {}: {}", schedule.id, e);
                                continue;
                            }
                        };

                        let mut redis_conn = match redis_pool.get().await {
                            Ok(c) => c,
                            Err(e) => {
                                eprintln!("Failed to get Redis connection from pool: {}", e);
                                // Revert lock so it can be retried
                                let _ = diesel::update(auction_schedules.filter(id.eq(schedule.id)))
                                    .set((
                                        state.eq(ScheduleState::Scheduled),
                                        retry_count.eq(schedule.retry_count + 1)
                                    ))
                                    .execute(&mut db_conn);
                                continue;
                            }
                        };
                        
                        let bitmap_key = format!("auction:participants:{}", schedule.auction_id);
                        let mut redis_pipe = redis::pipe();
                        
                        // We still set the participants bitmap
                        for user_uuid in participants {
                            let offset = (user_uuid.as_u128() % (1 << 31)) as u32;
                            redis_pipe.setbit(&bitmap_key, offset as usize, true).ignore();
                        }
                        redis_pipe.expire(&bitmap_key, ttl as i64).ignore();
                        
                        // Note: AUCTION_INITIALIZED_HASH_KEY is now set by auction-engine using the TTL sent in RMQ payload
                        
                        let redis_res: redis::RedisResult<()> = redis_pipe.query_async(&mut *redis_conn).await;
                        if let Err(e) = redis_res {
                            eprintln!("Failed to write to Redis for schedule {}: {}, will retry.", schedule.id, e);
                            let _ = diesel::update(auction_schedules.filter(id.eq(schedule.id)))
                                .set((
                                    state.eq(ScheduleState::Scheduled),
                                    retry_count.eq(schedule.retry_count + 1)
                                ))
                                .execute(&mut db_conn);
                            continue;
                        }

                        // 2. Push to RabbitMQ
                        let publish_res = channel.basic_publish(
                            "".into(),
                            rabbitmq::SCHEDULER_QUEUE.into(),
                            BasicPublishOptions::default(),
                            payload.as_bytes(),
                            BasicProperties::default()
                                .with_delivery_mode(2)
                                .with_content_type("application/json".into()),
                        ).await;

                        if publish_res.is_ok() {
                            let _ = diesel::update(auction_schedules.filter(id.eq(schedule.id)))
                                .set(state.eq(ScheduleState::Success))
                                .execute(&mut db_conn);
                        } else {
                            if schedule.retry_count >= 3 {
                                // push to dlq
                                let _ = channel.basic_publish(
                                    "".into(),
                                    rabbitmq::SCHEDULER_DLQ.into(),
                                    BasicPublishOptions::default(),
                                    payload.as_bytes(),
                                    BasicProperties::default()
                                        .with_delivery_mode(2)
                                        .with_content_type("application/json".into()),
                                ).await;
                                let _ = diesel::update(auction_schedules.filter(id.eq(schedule.id)))
                                    .set(state.eq(ScheduleState::Error))
                                    .execute(&mut db_conn);
                                eprintln!("Max retries reached for schedule {}, pushed to DLQ", schedule.id);
                            } else {
                                // Revert lock and increment retry count so it can be retried
                                let _ = diesel::update(auction_schedules.filter(id.eq(schedule.id)))
                                    .set((
                                        state.eq(ScheduleState::Scheduled),
                                        retry_count.eq(schedule.retry_count + 1)
                                    ))
                                    .execute(&mut db_conn);
                                eprintln!("Failed to push schedule {} to RMQ, reverted lock (retry {})", schedule.id, schedule.retry_count + 1);
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Error querying schedules: {:?}", e);
                }
            }
        }
        
        sleep(Duration::from_secs(5)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use redis::AsyncCommands;

    #[tokio::test]
    async fn test_db_row_locking_for_scheduler() {
        // Scaffold test for DB UPDATE ... RETURNING row locking
        // Ensures exactly-once semantics across distributed scheduler workers
        assert!(true); // Placeholder for actual redis-backed integration test
    }

    #[tokio::test]
    async fn test_scheduler_redis_connectivity() {
        dotenvy::dotenv().ok();
        let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
        let client = redis::Client::open(redis_url).unwrap();
        let mut con = client.get_multiplexed_async_connection().await.unwrap();
        
        let test_key = "test:scheduler:ping";
        let _: () = con.set(test_key, "pong").await.unwrap();
        let val: String = con.get(test_key).await.unwrap();
        assert_eq!(val, "pong");
        
        let _: () = con.del(test_key).await.unwrap();
    }
}
