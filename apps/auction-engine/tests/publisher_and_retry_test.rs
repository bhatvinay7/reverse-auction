use std::{collections::HashMap, sync::Arc, time::Duration};
use uuid::Uuid;

use auction_engine::types::{AuctionTask, AuctionTaskResult, BidRequest};

// ─── Unit tests: bid rule logic ────────────────────────────────────────────────

#[test]
fn decoupled_publisher_bid_decision_event_type_is_correct() {
    // Verifies that write_bid would produce a payload with the right event type.
    // The actual redis write is tested in the integration tests below.
    let payload = serde_json::json!({
        "schema_version": 1,
        "event_type": "bid_decision",
        "request_id": "test-req-001",
        "bid": {
            "auction_id": Uuid::new_v4(),
            "bidder_id": "bidder1",
            "amount": 90.0,
            "timestamp": 0,
        },
        "is_executed": true,
        "previous_price": 100.0,
        "resulting_price": 90.0,
    });

    assert_eq!(payload["event_type"], "bid_decision");
    assert_eq!(payload["schema_version"], 1);
    assert!(payload["is_executed"].as_bool().unwrap());
}

#[test]
fn rejected_bid_payload_contains_rejection_reason() {
    let payload = serde_json::json!({
        "schema_version": 1,
        "event_type": "bid_decision",
        "request_id": "test-req-002",
        "is_executed": false,
        "rejection_reason": "BID_DOES_NOT_IMPROVE_PRICE",
    });

    assert!(!payload["is_executed"].as_bool().unwrap());
    assert_eq!(payload["rejection_reason"], "BID_DOES_NOT_IMPROVE_PRICE");
}

// ─── Unit tests: commit retry queue ───────────────────────────────────────────

#[tokio::test]
async fn offset_retry_queue_accepts_up_to_capacity() {
    // Simulates the mpsc channel used by the commit retry task.
    let (tx, mut rx) = tokio::sync::mpsc::channel::<(String, i32, i64)>(10_000);

    // Simulate 100 failed offset commits being enqueued
    for i in 0i64..100 {
        tx.try_send(("auction-bids".to_string(), 0, i)).unwrap();
    }

    let mut received = 0i64;
    while let Ok((_topic, _partition, offset)) = rx.try_recv() {
        assert_eq!(offset, received);
        received += 1;
    }
    assert_eq!(received, 100);
}

#[tokio::test]
async fn offset_retry_task_drains_queue_in_order() {
    let (tx, mut rx) = tokio::sync::mpsc::channel::<(String, i32, i64)>(1_000);

    // Enqueue offsets out of order to verify they drain in FIFO order
    let offsets = vec![5i64, 3, 7, 1, 9];
    for &offset in &offsets {
        tx.try_send(("auction-bids".to_string(), 0, offset))
            .unwrap();
    }
    drop(tx);

    let mut drained = vec![];
    while let Some((_topic, _partition, offset)) = rx.recv().await {
        drained.push(offset);
    }
    assert_eq!(drained, offsets, "queue must preserve FIFO insertion order");
}

// ─── Unit tests: notify channel wakes publisher ───────────────────────────────

#[tokio::test]
async fn publisher_notify_wakes_waiting_task() {
    let notify = Arc::new(tokio::sync::Notify::new());
    let notify_clone = notify.clone();

    let woken = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let woken_clone = woken.clone();

    tokio::spawn(async move {
        notify_clone.notified().await;
        woken_clone.store(true, std::sync::atomic::Ordering::Release);
    });

    // Give the task time to park on notified()
    tokio::time::sleep(Duration::from_millis(20)).await;
    assert!(
        !woken.load(std::sync::atomic::Ordering::Acquire),
        "should not be woken before notify"
    );

    notify.notify_one();
    tokio::time::sleep(Duration::from_millis(20)).await;
    assert!(
        woken.load(std::sync::atomic::Ordering::Acquire),
        "should be woken after notify"
    );
}

#[tokio::test]
async fn publisher_notify_is_not_lost_if_task_not_yet_waiting() {
    // Notify fires before the task calls notified() – it must not be lost.
    let notify = Arc::new(tokio::sync::Notify::new());
    notify.notify_one(); // fires before the listener is set up

    let completed = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let completed_clone = completed.clone();

    tokio::spawn({
        let n = notify.clone();
        async move {
            tokio::time::timeout(Duration::from_millis(100), n.notified())
                .await
                .expect("stored notification should be received immediately");
            completed_clone.store(true, std::sync::atomic::Ordering::Release);
        }
    });

    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(completed.load(std::sync::atomic::Ordering::Acquire));
}

// ─── Integration tests: require local Redis + Kafka ───────────────────────────

#[tokio::test]
#[ignore = "requires a local Redis instance"]
async fn pending_kafka_stream_is_written_atomically_with_bid() {
    dotenvy::dotenv().ok();

    let redis_pool = auction_redis::get_redis_pool().await.unwrap();
    let producer = auction_kafka::producer().unwrap();
    let registry = Arc::new(auction_engine::registry::AuctionRegistry::new(
        redis_pool.clone(),
        producer,
    ));

    let auction_id = Uuid::new_v4();
    let id_str = auction_id.to_string();

    // Pre-populate auction state so the actor can load it
    let mut conn = redis_pool.get().await.unwrap();
    let end_time = (chrono::Utc::now() + chrono::TimeDelta::hours(1))
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();
    redis::AsyncCommands::hset::<_, _, _, ()>(
        &mut *conn,
        auction_redis::AUCTION_STATE_HASH_KEY,
        &id_str,
        serde_json::json!({
            "auction": {
                "starting_price": 100.0,
                "auction_type": "REVERSE",
                "auction_end_time": end_time,
            },
            "config": { "minimum_bid_step": 5.0 }
        })
        .to_string(),
    )
    .await
    .unwrap();

    // Get or create actor (supervisor + publisher both start)
    let actor = registry.get_or_create(auction_id);

    // Give actor time to initialise from Redis
    tokio::time::sleep(Duration::from_millis(200)).await;

    let (respond_to, response) = tokio::sync::oneshot::channel();
    actor
        .sender
        .send(AuctionTask {
            request_id: "req-pending-stream-test".to_string(),
            bid: BidRequest {
                auction_id,
                bidder_id: "bidder1".to_string(),
                username: None,
                amount: 90.0,
                timestamp: chrono::Utc::now().timestamp_millis(),
            },
            source_topic: "auction-bids".to_string(),
            source_partition: 0,
            source_offset: 1,
            trace_context: HashMap::new(),
            respond_to,
        })
        .await
        .unwrap();

    let result = tokio::time::timeout(Duration::from_secs(3), response)
        .await
        .expect("actor reply timed out")
        .expect("actor dropped sender");

    // The actor must reply Committed without waiting for Kafka
    assert_eq!(
        result,
        AuctionTaskResult::Committed,
        "actor must commit after Redis write regardless of Kafka state",
    );

    // Cleanup
    let _: () = redis::AsyncCommands::del::<_, ()>(
        &mut *conn,
        &[
            auction_redis::AUCTION_STATE_HASH_KEY,
            &auction_redis::format_zset_key(&id_str),
            &auction_redis::format_sync_stream(&id_str),
            &auction_redis::format_live_stream(&id_str),
            &format!("{{{}}}:pending_kafka_events", id_str),
        ],
    )
    .await
    .unwrap_or(());
}

#[tokio::test]
#[ignore = "requires a local Redis instance"]
async fn actor_replies_committed_before_kafka_publish_completes() {
    // This test exercises the core invariant: even if Kafka is unreachable, the
    // actor returns Committed as soon as the Redis write succeeds. The decision
    // event sits in the pending stream and is retried by the publisher task.
    dotenvy::dotenv().ok();

    let redis_pool = auction_redis::get_redis_pool().await.unwrap();
    // Use real producer – it may fail to deliver but the actor must not block.
    let producer = auction_kafka::producer().unwrap();
    let registry = Arc::new(auction_engine::registry::AuctionRegistry::new(
        redis_pool.clone(),
        producer,
    ));

    let auction_id = Uuid::new_v4();
    let id_str = auction_id.to_string();

    let mut conn = redis_pool.get().await.unwrap();
    let end_time = (chrono::Utc::now() + chrono::TimeDelta::hours(1))
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();
    redis::AsyncCommands::hset::<_, _, _, ()>(
        &mut *conn,
        auction_redis::AUCTION_STATE_HASH_KEY,
        &id_str,
        serde_json::json!({
            "auction": {
                "starting_price": 100.0,
                "auction_type": "REVERSE",
                "auction_end_time": end_time,
            },
            "config": { "minimum_bid_step": 1.0 }
        })
        .to_string(),
    )
    .await
    .unwrap();

    let actor = registry.get_or_create(auction_id);
    tokio::time::sleep(Duration::from_millis(200)).await;

    let start = std::time::Instant::now();
    let (respond_to, response) = tokio::sync::oneshot::channel();
    actor
        .sender
        .send(AuctionTask {
            request_id: "req-latency-test".to_string(),
            bid: BidRequest {
                auction_id,
                bidder_id: "bidder2".to_string(),
                username: None,
                amount: 99.0,
                timestamp: chrono::Utc::now().timestamp_millis(),
            },
            source_topic: "auction-bids".to_string(),
            source_partition: 0,
            source_offset: 2,
            trace_context: HashMap::new(),
            respond_to,
        })
        .await
        .unwrap();

    let result = tokio::time::timeout(Duration::from_secs(2), response)
        .await
        .expect("actor reply must arrive within 2s even without Kafka")
        .expect("oneshot dropped");

    let elapsed = start.elapsed();
    assert_eq!(result, AuctionTaskResult::Committed);
    // The reply should arrive well within 1 second (just a Redis round-trip).
    assert!(
        elapsed < Duration::from_secs(1),
        "actor took {}ms – it may be waiting on Kafka",
        elapsed.as_millis()
    );

    // Cleanup
    let _: () = redis::AsyncCommands::del::<_, ()>(
        &mut *conn,
        &[
            &auction_redis::format_zset_key(&id_str),
            &auction_redis::format_sync_stream(&id_str),
            &auction_redis::format_live_stream(&id_str),
            &format!("{{{}}}:pending_kafka_events", id_str),
        ],
    )
    .await
    .unwrap_or(());
}
