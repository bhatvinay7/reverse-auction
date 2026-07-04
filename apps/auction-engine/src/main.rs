use dashmap::DashMap;
use db::models::{AuctionSchedule, Shipment};
use db::schema::shipments;
use diesel::prelude::*;
use futures_util::stream::StreamExt;
use lapin::{options::*, types::FieldTable, BasicProperties};
use redis::{AsyncCommands, streams::{StreamReadReply, StreamReadOptions}};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;
use chrono::{NaiveDateTime, Utc};

pub const AUCTION_INITIALIZED_HASH_KEY: &str = "auction:initialized:hash";

// --- Data Packets ---
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BidRequest {
    pub auction_id: Uuid,
    pub bidder_id: String,
    pub username: Option<String>,
    pub amount: f64,
    pub timestamp: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum AuctionCommand {
    PlaceBid(BidRequest),
    EndAuction,
}

#[derive(Clone, Debug)]
pub enum ResponseState {
    Bid {
        bid: BidRequest,
        is_executed: bool,
    },
    EndAuction,
}

pub struct WorkerRecoveryContext {
    pub receiver: mpsc::Receiver<AuctionCommand>,
    pub unhandled_in_flight_cmd: Option<AuctionCommand>,
}

pub struct LedgerRecoveryContext {
    pub receiver: mpsc::Receiver<ResponseState>,
    pub unhandled_in_flight: Option<ResponseState>,
}

pub struct GlobalRegistry {
    pub active_auctions: DashMap<Uuid, mpsc::Sender<AuctionCommand>>,
    pub redis_client: bb8::Pool<bb8_redis::RedisConnectionManager>,
    pub rmq_channel: Arc<tokio::sync::Mutex<lapin::Channel>>,
}

impl GlobalRegistry {
    pub fn new(client: bb8::Pool<bb8_redis::RedisConnectionManager>, rmq_channel: lapin::Channel) -> Self {
        Self {
            active_auctions: DashMap::new(),
            redis_client: client,
            rmq_channel: Arc::new(tokio::sync::Mutex::new(rmq_channel)),
        }
    }

    pub fn spawn_resilient_pipeline(self: Arc<Self>, auction_id: Uuid, end_time: NaiveDateTime, starting_price: f64) {
        let (input_tx, input_rx) = mpsc::channel::<AuctionCommand>(5000);
        let (output_tx, output_rx) = mpsc::channel::<ResponseState>(5000);
        
        self.active_auctions.insert(auction_id, input_tx.clone());

        // Worker 1: Valuation Supervisor
        let ctx_arc = Arc::new(tokio::sync::Mutex::new(WorkerRecoveryContext {
            receiver: input_rx,
            unhandled_in_flight_cmd: None,
        }));

        let ctx_arc_clone = ctx_arc.clone();
        tokio::spawn(async move {
            loop {
                let supervisor_handle = tokio::spawn(run_valuation_worker(ctx_arc_clone.clone(), output_tx.clone(), starting_price));
                if let Err(join_err) = supervisor_handle.await {
                    eprintln!("Critical panic in valuation worker for {}! Panic: {:?}", auction_id, join_err);
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                } else {
                    println!("Auction {} valuation pipeline terminated cleanly.", auction_id);
                    break;
                }
            }
        });

        // Worker 2: Redis Ledger Supervisor
        let ledger_ctx_arc = Arc::new(tokio::sync::Mutex::new(LedgerRecoveryContext {
            receiver: output_rx,
            unhandled_in_flight: None,
        }));

        let client_clone = self.redis_client.clone();
        let rmq_channel_clone = self.rmq_channel.clone();
        let global_registry = self.clone();
        tokio::spawn(async move {
            loop {
                let client = client_clone.clone();
                let rmq_ch = rmq_channel_clone.clone();
                let supervisor_handle = tokio::spawn(run_redis_ledger_worker(auction_id, ledger_ctx_arc.clone(), client, rmq_ch));
                if let Err(crash_err) = supervisor_handle.await {
                    eprintln!("CRASH DETECTED: Redis ledger worker for {} died: {:?}", auction_id, crash_err);
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                } else {
                    println!("Auction {} ledger pipeline terminated cleanly.", auction_id);
                    // Safe Teardown: Remove from registry
                    global_registry.active_auctions.remove(&auction_id);
                    break;
                }
            }
        });

        // Worker 3: RabbitMQ consumer — reads from auction:logs:{id} and feeds the in-memory channel
        let bid_queue = rabbitmq::auction_bid_queue(&auction_id.to_string());
        let rmq_channel_consumer = self.rmq_channel.clone();
        let input_tx_rmq = input_tx.clone();
        tokio::spawn(async move {
            use futures_util::stream::StreamExt;
            let channel = rmq_channel_consumer.lock().await;
            
            // Re-declare the queue dynamically to ensure it exists on RMQ restarts
            let mut dlq_args = lapin::types::FieldTable::default();
            dlq_args.insert(
                "x-dead-letter-exchange".into(),
                lapin::types::AMQPValue::LongString("".into()),
            );
            dlq_args.insert(
                "x-dead-letter-routing-key".into(),
                lapin::types::AMQPValue::LongString(rabbitmq::AUCTION_BIDS_DLQ.into()),
            );
            let mut per_q_opts = lapin::options::QueueDeclareOptions::default();
            per_q_opts.durable = true;
            let _ = channel.queue_declare(bid_queue.as_str().into(), per_q_opts, dlq_args).await;

            let consumer_tag = format!("engine-{}-{}", auction_id, Uuid::new_v4());
            let consumer = channel.basic_consume(
                bid_queue.as_str().into(),
                consumer_tag.as_str().into(),
                BasicConsumeOptions::default(),
                lapin::types::FieldTable::default(),
            ).await;
            drop(channel); // release lock immediately after consume setup
            
            match consumer {
                Ok(mut consumer) => {
                    println!("[auction-engine] RMQ consumer started SUCCESSFULLY for {}", bid_queue);
                    while let Some(delivery) = consumer.next().await {
                        match delivery {
                            Ok(delivery) => {
                                println!("[auction-engine] Received raw delivery data: {:?}", String::from_utf8_lossy(&delivery.data));
                                match serde_json::from_slice::<BidRequest>(&delivery.data) {
                                    Ok(bid_req) => {
                                        if bid_req.auction_id == auction_id {
                                            let _ = input_tx_rmq.send(AuctionCommand::PlaceBid(bid_req)).await;
                                        }
                                        let _ = delivery.ack(BasicAckOptions::default()).await;
                                    }
                                    Err(e) => {
                                        eprintln!("[auction-engine] Failed to parse bid from RMQ: {}", e);
                                        // NACK without requeue → goes to DLQ
                                        let _ = delivery.nack(BasicNackOptions { requeue: false, multiple: false }).await;
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!("[auction-engine] RMQ delivery error for {}: {}", bid_queue, e);
                                break;
                            }
                        }
                    }
                    println!("[auction-engine] RMQ consumer for {} terminated.", bid_queue);
                }
                Err(e) => {
                    eprintln!("[auction-engine] Failed to start RMQ consumer for {}: {}", bid_queue, e);
                }
            }
        });

        // Timeout Trigger: Send Poison Pill
        tokio::spawn(async move {
            let now = Utc::now().naive_utc();
            if end_time > now {
                let duration = (end_time - now).to_std().unwrap_or(std::time::Duration::from_secs(0));
                tokio::time::sleep(duration).await;
            }
            // Send EndAuction Poison Pill
            let _ = input_tx.send(AuctionCommand::EndAuction).await;
        });
    }
}

async fn run_valuation_worker(
    ctx_arc: Arc<tokio::sync::Mutex<WorkerRecoveryContext>>,
    output_tx: mpsc::Sender<ResponseState>,
    initial_price: f64
) {
    let mut current_lowest_bid = initial_price;

    loop {
        let mut ctx = ctx_arc.lock().await;
        let cmd = match ctx.unhandled_in_flight_cmd.take() {
            Some(leftover) => leftover,
            None => {
                match ctx.receiver.recv().await {
                    Some(next_cmd) => next_cmd,
                    None => return, // EOF
                }
            }
        };
        // Secure it in flight
        ctx.unhandled_in_flight_cmd = Some(cmd.clone());
        drop(ctx);

        let response = match &cmd {
            AuctionCommand::PlaceBid(bid) => {
                let mut executed = false;
                if bid.amount < current_lowest_bid {
                    current_lowest_bid = bid.amount;
                    executed = true;
                }
                ResponseState::Bid { bid: bid.clone(), is_executed: executed }
            },
            AuctionCommand::EndAuction => ResponseState::EndAuction,
        };

        if let Err(_) = output_tx.send(response).await {
            eprintln!("Channel 2 dropped. Safe exit valuation worker.");
            return;
        }

        let mut ctx = ctx_arc.lock().await;
        ctx.unhandled_in_flight_cmd = None;

        if let AuctionCommand::EndAuction = cmd {
            return; // Poison pill reached, clean termination
        }
    }
}

struct RedisConnection(bb8::Pool<bb8_redis::RedisConnectionManager>);
impl socketioxide_emitter::Driver for RedisConnection {
    type Error = redis::RedisError;

    async fn emit(&self, channel: String, data: Vec<u8>) -> Result<(), Self::Error> {
        let mut con = self.0.get().await.map_err(|e| redis::RedisError::from(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
        redis::AsyncCommands::publish::<_, _, redis::Value>(&mut *con, channel, data).await?;
        Ok(())
    }
}

async fn run_redis_ledger_worker(
    auction_id: Uuid,
    ctx_arc: Arc<tokio::sync::Mutex<LedgerRecoveryContext>>,
    pool: bb8::Pool<bb8_redis::RedisConnectionManager>,
    rmq_channel: Arc<tokio::sync::Mutex<lapin::Channel>>,
) {
        let id_str = auction_id.to_string();
        let zset_key = auction_redis::format_zset_key(&id_str);
        let sync_stream = auction_redis::format_sync_stream(&id_str);
        let live_stream = auction_redis::format_live_stream(&id_str);
        // let pubsub_channel = auction_redis::format_pubsub_channel(&id_str); // No longer needed
        
        let emitter_conn = RedisConnection(pool.clone());
        let emitter = socketioxide_emitter::IoEmitter::new();

        loop {
            let mut ctx = ctx_arc.lock().await;
            let state = match ctx.unhandled_in_flight.take() {
                Some(leftover) => leftover,
                None => {
                    match ctx.receiver.recv().await {
                        Some(next_state) => next_state,
                        None => return, // EOF
                    }
                }
            };
            ctx.unhandled_in_flight = Some(state.clone());
            drop(ctx);

            let mut con = match pool.get().await {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to get redis connection from pool: {}", e);
                    continue; // Skip and try again or wait? Actually, maybe panic since we can't write ledger
                }
            };

            match state {
                ResponseState::Bid { bid, is_executed } => {
                    let payload = json!({
                        "bid": bid,
                        "is_executed": is_executed
                    });
                    let payload_json = payload.to_string();

                    if is_executed {
                        let write_result: Result<(), _> = redis::pipe()
                            .atomic()
                            .xadd(&sync_stream, "*", &[("bid_data", &payload_json)])
                            .xadd(&live_stream, "*", &[("bid_data", &payload_json)])
                            .zadd(&zset_key, &payload_json, bid.amount)
                            .query_async(&mut *con)
                            .await;

                        if write_result.is_err() {
                            panic!("Redis connection lost while processing auction ledger!");
                        }
                    } else {
                        let _: Result<(), _> = redis::pipe()
                            .atomic()
                            .xadd(&sync_stream, "*", &[("failed_data", &payload_json)])
                            .xadd(&live_stream, "*", &[("failed_data", &payload_json)])
                            .query_async(&mut *con)
                            .await;
                    }
                    
                    // Emit via standard Redis PubSub so ws-server can manually broadcast it
                    let pubsub_payload = serde_json::json!({
                        "auction_id": id_str.clone(),
                        "payload": payload
                    }).to_string();
                    let _: redis::RedisResult<()> = con.publish("auction:updates", pubsub_payload).await;
                    println!("[auction-engine] Successfully emitted bid_update to custom Redis channel for auction {}", id_str);
                },
                ResponseState::EndAuction => {
                    use redis::AsyncCommands;
                    // 1. Fetch winning bid
                    let lowest_bids: Vec<String> = con.zrange(&zset_key, 0, 0).await.unwrap_or_default();
                    let winning_bid = lowest_bids.first().cloned();

                    // 2. Fetch current auction state
                    let current_state: Option<String> = con.hget(auction_redis::AUCTION_STATE_HASH_KEY, &id_str).await.unwrap_or(None);
                    
                    let mut winner_value = None;
                    if let Some(state_str) = current_state {
                        if let Ok(mut state_json) = serde_json::from_str::<serde_json::Value>(&state_str) {
                            if let Some(shipment) = state_json.get_mut("shipment") {
                                shipment["status"] = json!("Completed");
                            }
                            if let Some(winner) = &winning_bid {
                                if let Ok(winner_json) = serde_json::from_str::<serde_json::Value>(winner) {
                                    state_json["winner"] = winner_json.clone();
                                    winner_value = Some(winner_json);
                                }
                            }

                            // 3. Update Redis state
                            let _: Result<(), _> = redis::pipe()
                                .atomic()
                                .hset(auction_redis::AUCTION_STATE_HASH_KEY, &id_str, state_json.to_string())
                                .query_async(&mut *con)
                                .await;

                            // 4. Publish auctionId to sync tasks queue on RabbitMQ
                            let sync_payload = json!({ "auction_id": id_str }).to_string();
                            let rmq = rmq_channel.lock().await;
                            let sync_result = rmq
                                .basic_publish(
                                    "".into(),
                                    rabbitmq::AUCTION_SYNC_TASKS_QUEUE.into(),
                                    BasicPublishOptions::default(),
                                    sync_payload.as_bytes(),
                                    BasicProperties::default()
                                        .with_delivery_mode(2)
                                        .with_content_type("application/json".into()),
                                )
                                .await;
                            drop(rmq);
                            match sync_result {
                                Ok(_) => println!("[auction-engine] Published auction {} to sync tasks queue.", id_str),
                                Err(e) => eprintln!("[auction-engine] Failed to publish sync task for {}: {}", id_str, e),
                            }
                        }
                    }

                    // Emit auction_closed event
                    let close_payload = json!({
                        "event": "auction_closed",
                        "data": winner_value
                    });
                    let _ = emitter.clone().to(id_str.clone()).emit("auction_closed", &close_payload, &emitter_conn).await;

                    let mut ctx = ctx_arc.lock().await;
                    ctx.unhandled_in_flight = None;
                    return; // Clean termination
                }
            }

            let mut ctx = ctx_arc.lock().await;
            ctx.unhandled_in_flight = None;
        }
}

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
        .map_err(|e| format!("Failed to declare SCHEDULER_QUEUE: {}", e))?;
    channel.queue_declare(rabbitmq::NOTIFICATION_QUEUE.into(), queue_opts.clone(), FieldTable::default()).await
        .map_err(|e| format!("Failed to declare NOTIFICATION_QUEUE: {}", e))?;
    // Declare the shared global DLQ for all per-auction bid queues (once at startup)
    channel.queue_declare(rabbitmq::AUCTION_BIDS_DLQ.into(), queue_opts.clone(), FieldTable::default()).await
        .map_err(|e| format!("Failed to declare AUCTION_BIDS_DLQ: {}", e))?;
    // Declare the sync tasks queue (consumed by notification-worker)
    channel.queue_declare(rabbitmq::AUCTION_SYNC_TASKS_QUEUE.into(), queue_opts.clone(), FieldTable::default()).await
        .map_err(|e| format!("Failed to declare AUCTION_SYNC_TASKS_QUEUE: {}", e))?;
    println!("[auction-engine] Global queues declared: DLQ='{}', sync='{}'.",
        rabbitmq::AUCTION_BIDS_DLQ, rabbitmq::AUCTION_SYNC_TASKS_QUEUE);

    let redis_pool = auction_redis::get_redis_pool().await.map_err(|e| format!("Failed to create Redis pool: {}", e))?;
    // A second channel is used for the registry (bid consuming / sync publishing)
    // so the scheduler consumer channel is not blocked.
    let registry_channel = rmq_conn.create_channel().await.map_err(|e| format!("Failed to create registry RMQ channel: {}", e))?;
    let registry = Arc::new(GlobalRegistry::new(redis_pool.clone(), registry_channel));
    
    let mut bits = Vec::with_capacity(1_000_000);
    for _ in 0..1_000_000 {
        bits.push(AtomicU8::new(0));
    }
    let local_bitset = Arc::new(bits);

    // Startup Recovery: Pre-warm memory for auction liveness using Redis keys
    let mut redis_conn_init = redis_pool.get().await.map_err(|e| format!("Failed to get init conn: {}", e))?;
    let init_keys: Result<std::collections::HashMap<String, String>, _> = redis::cmd("HGETALL").arg(AUCTION_INITIALIZED_HASH_KEY).query_async(&mut *redis_conn_init).await;
    if let Ok(keys) = init_keys {
        use redis::AsyncCommands;
        for (id_str, _) in keys {
            if let Ok(uuid) = Uuid::parse_str(&id_str) {
                let state_str: Result<Option<String>, _> = (*redis_conn_init).hget(auction_redis::AUCTION_STATE_HASH_KEY, &id_str).await;
                if let Ok(Some(s)) = state_str {
                    if let Ok(state_json) = serde_json::from_str::<serde_json::Value>(&s) {
                        let mut end_time = chrono::Utc::now().naive_utc() + chrono::Duration::minutes(3); // fallback
                        let mut starting_price = f64::MAX;
                        
                        if let Some(shipment) = state_json.get("shipment") {
                            if let Some(end_time_str) = shipment.get("auction_end_time").and_then(|st| st.as_str()) {
                                if let Ok(et) = chrono::NaiveDateTime::parse_from_str(end_time_str, "%Y-%m-%dT%H:%M:%S%.f")
                                    .or_else(|_| chrono::NaiveDateTime::parse_from_str(end_time_str, "%Y-%m-%dT%H:%M:%S")) {
                                    end_time = et;
                                }
                            }
                            if let Some(price) = shipment.get("starting_price").and_then(|p| p.as_f64()) {
                                starting_price = price;
                            }
                        }

                        // Fetch the current actual lowest bid from the ZSET to prevent memory loss
                        let zset_key = auction_redis::format_zset_key(&id_str);
                        let lowest_bid_result: Result<Vec<String>, _> = (*redis_conn_init).zrange(&zset_key, 0, 0).await;
                        if let Ok(bids) = lowest_bid_result {
                            if let Some(lowest_str) = bids.first() {
                                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(lowest_str) {
                                    if let Some(amount) = parsed.get("bid").and_then(|b| b.get("amount")).and_then(|a| a.as_f64()) {
                                        starting_price = amount;
                                        println!("[auction-engine] Found existing lowest bid of {} for recovered auction {}", starting_price, uuid);
                                    }
                                }
                            }
                        }

                        // Respawn the resilient pipeline for this node
                        registry.clone().spawn_resilient_pipeline(uuid, end_time, starting_price);
                        let index = (uuid.as_u128() % local_bitset.len() as u128) as usize;
                        local_bitset[index].fetch_or(1, Ordering::SeqCst);
                        println!("Pre-warmed auction pipeline state for engine node: {}", uuid);
                    }
                }
            }
        }
    }

    println!("Auction Engine started.");

    let mut consumer = channel.basic_consume(
        rabbitmq::SCHEDULER_QUEUE.into(),
        "auction_engine_worker".into(),
        BasicConsumeOptions::default(),
        FieldTable::default(),
    ).await.map_err(|e| format!("basic_consume failed: {}", e))?;

    while let Some(delivery) = consumer.next().await {
        if let Ok(delivery) = delivery {
            if let Ok(payload_val) = serde_json::from_slice::<serde_json::Value>(&delivery.data) {
                if let Ok(schedule) = serde_json::from_value::<AuctionSchedule>(payload_val.clone()) {
                    let _schedule_id_str = schedule.id.to_string();
                    let auction_id_str = schedule.auction_id.to_string();
                    let idempotency_key = format!("auction:processed:{}", schedule.idempotency_key);
                    
                    let mut ttl = payload_val.get("ttl").and_then(|v| v.as_u64()).unwrap_or(600);
                    if ttl == 0 {
                        ttl = 600;
                    }

                    let mut redis_conn = match redis_pool.get().await {
                        Ok(c) => c,
                        Err(e) => {
                            eprintln!("Failed to get redis connection from pool: {}", e);
                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                            continue;
                        }
                    };

                    let exists: Result<bool, _> = redis_conn.exists(&idempotency_key).await;
                    if let Ok(true) = exists {
                        let _ = delivery.ack(BasicAckOptions::default()).await;
                        continue;
                    }

                    if let Ok(mut db_conn) = pool.get() {
                        let shipment: QueryResult<Shipment> = shipments::table
                            .filter(shipments::id.eq(schedule.auction_id))
                            .select(Shipment::as_select())
                            .first(&mut db_conn);

                        if let Ok(shipment) = shipment {
                            let payload = json!({
                                "schedule": schedule,
                                "shipment": shipment
                            });
                            let payload_str = payload.to_string();
                            let timestamp = schedule.start_time.and_utc().timestamp();

                            let init_key = format!("auction:initialized:{}", auction_id_str);

                            // Phase 2 Step 1: Declare per-auction RMQ queue with DLQ binding
                            // MUST succeed before we set the Redis initialized flag.
                            let bid_queue = rabbitmq::auction_bid_queue(&auction_id_str);
                            let mut dlq_args = lapin::types::FieldTable::default();
                            dlq_args.insert(
                                "x-dead-letter-exchange".into(),
                                lapin::types::AMQPValue::LongString("".into()),
                            );
                            dlq_args.insert(
                                "x-dead-letter-routing-key".into(),
                                lapin::types::AMQPValue::LongString(rabbitmq::AUCTION_BIDS_DLQ.into()),
                            );
                            let mut per_q_opts = QueueDeclareOptions::default();
                            per_q_opts.durable = true;
                            if let Err(e) = channel.queue_declare(bid_queue.as_str().into(), per_q_opts, dlq_args).await {
                                eprintln!("[auction-engine] Failed to declare per-auction queue {}: {}", bid_queue, e);
                                let _ = delivery.nack(BasicNackOptions::default()).await;
                                continue;
                            }
                            println!("[auction-engine] Per-auction queue '{}' declared with DLQ binding.", bid_queue);

                            let mut pipe = redis::pipe();
                            pipe.atomic()
                                .hset(auction_redis::AUCTION_STATE_HASH_KEY, &auction_id_str, &payload_str)
                                .hset(auction_redis::AUCTION_INITIALIZED_HASH_KEY, &auction_id_str, "1")
                                .zadd(auction_redis::AUCTION_SCHEDULE_ZSET_KEY, &auction_id_str, timestamp)
                                .set_ex(&idempotency_key, "1", 600)
                                .set_ex(&init_key, "1", ttl); 

                            let pipe_res: Result<(), _> = pipe.query_async(&mut *redis_conn).await;
                            
                            if pipe_res.is_ok() {
                                let starting_price = shipment.starting_price.unwrap_or(f64::MAX);
                                registry.clone().spawn_resilient_pipeline(schedule.auction_id, shipment.auction_end_time, starting_price);
                                let index = (schedule.auction_id.as_u128() % local_bitset.len() as u128) as usize;
                                local_bitset[index].fetch_or(1, Ordering::SeqCst);
                                // Trigger notification
                                let notif = json!({
                                    "event_type": "auction_started",
                                    "auction_id": auction_id_str,
                                    "message": format!("Auction {} has started!", auction_id_str),
                                    "retry_count": 0
                                });
                                let _ = channel.basic_publish(
                                    "".into(),
                                    rabbitmq::NOTIFICATION_QUEUE.into(),
                                    BasicPublishOptions::default(),
                                    notif.to_string().as_bytes(),
                                    BasicProperties::default()
                                        .with_delivery_mode(2)
                                        .with_content_type("application/json".into()),
                                ).await;

                        } else {
                            eprintln!("Error adding to redis: {:?}", pipe_res);
                        }
                    } else {
                        eprintln!("Could not find shipment for shipment_id {}", schedule.auction_id);
                    }
                    }
                }
            }
            let _ = delivery.ack(BasicAckOptions::default()).await;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_valuation_worker_ordering() {
        let (input_tx, input_rx) = mpsc::channel::<AuctionCommand>(10);
        let (output_tx, mut output_rx) = mpsc::channel::<ResponseState>(10);
        
        let ctx_arc = Arc::new(tokio::sync::Mutex::new(WorkerRecoveryContext {
            receiver: input_rx,
            unhandled_in_flight_cmd: None,
        }));
        
        // Spawn valuation worker
        tokio::spawn(run_valuation_worker(ctx_arc, output_tx, 1000.0));
        
        let auction_id = Uuid::new_v4();
        
        // Send a first bid
        let bid1 = BidRequest {
            auction_id,
            bidder_id: "user_1".to_string(),
            username: None,
            amount: 500.0,
            timestamp: 1000,
        };
        input_tx.send(AuctionCommand::PlaceBid(bid1.clone())).await.unwrap();
        
        // Should execute as it's the lowest (first)
        if let Some(ResponseState::Bid { bid, is_executed }) = output_rx.recv().await {
            assert_eq!(bid.amount, 500.0);
            assert!(is_executed);
        } else {
            panic!("Expected Bid response");
        }
        
        // Send a higher bid (should not execute)
        let bid2 = BidRequest {
            auction_id,
            bidder_id: "user_2".to_string(),
            username: None,
            amount: 600.0,
            timestamp: 1001,
        };
        input_tx.send(AuctionCommand::PlaceBid(bid2.clone())).await.unwrap();
        
        if let Some(ResponseState::Bid { bid, is_executed }) = output_rx.recv().await {
            assert_eq!(bid.amount, 600.0);
            assert!(!is_executed); // Important: failed bid check
        } else {
            panic!("Expected Bid response");
        }
        
        // Send a lower bid (should execute)
        let bid3 = BidRequest {
            auction_id,
            bidder_id: "user_3".to_string(),
            username: None,
            amount: 400.0,
            timestamp: 1002,
        };
        input_tx.send(AuctionCommand::PlaceBid(bid3.clone())).await.unwrap();
        
        if let Some(ResponseState::Bid { bid, is_executed }) = output_rx.recv().await {
            assert_eq!(bid.amount, 400.0);
            assert!(is_executed); 
        } else {
            panic!("Expected Bid response");
        }
        
        // Send Poison Pill
        input_tx.send(AuctionCommand::EndAuction).await.unwrap();
        
        if let Some(ResponseState::EndAuction) = output_rx.recv().await {
            // Clean exit verified
        } else {
            panic!("Expected EndAuction response");
        }
    }

    #[tokio::test]
    async fn test_redis_integration() {
        dotenvy::dotenv().ok();
        let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
        let client = redis::Client::open(redis_url).unwrap();
        let mut con = client.get_multiplexed_async_connection().await.unwrap();
        
        let test_key = "test:auction_engine:ping";
        let _: () = redis::AsyncCommands::set(&mut con, test_key, "pong").await.unwrap();
        let val: String = redis::AsyncCommands::get(&mut con, test_key).await.unwrap();
        assert_eq!(val, "pong");
        
        let _: () = redis::AsyncCommands::del(&mut con, test_key).await.unwrap();
    }
}
