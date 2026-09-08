#![allow(clippy::collapsible_if)]
use std::time::Duration;

use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use tokio::sync::mpsc;
use tokio_postgres::NoTls;

use pgwire_replication::{Lsn, PgWireError, ReplicationClient, ReplicationEvent};

use crate::{
    config::AppConfig,
    decoder::{RelationRegistry, WalEvent},
};

// SQLSTATE 55006 — object_in_use (slot held by another backend)
const SQLSTATE_OBJECT_IN_USE: &str = "55006";

type Error = Box<dyn std::error::Error + Send + Sync>;

// ── Domain event type ─────────────────────────────────────────────────────────

struct WalMessage {
    lsn: Lsn,
    topic: &'static str,
    key: String,
    payload: Vec<u8>,
}

// ── Entry point ───────────────────────────────────────────────────────────────

pub async fn run() -> Result<(), Error> {
    let cfg = AppConfig::from_env();

    // Fail fast: verify wal_level and publication before touching the slot.
    precheck(&cfg).await?;

    let (slot_lsn, _restart_lsn) = ensure_slot(&cfg).await?;
    let start_lsn = slot_lsn;

    let (event_tx, event_rx) = mpsc::channel::<WalMessage>(4096);
    let (lsn_ack_tx, mut lsn_ack_rx) = mpsc::unbounded_channel::<Lsn>();

    let producer = auction_kafka::producer()?;
    tokio::spawn(publisher_task(event_rx, lsn_ack_tx, producer));

    eprintln!(
        "[CDC] connecting to PostgreSQL WAL slot='{}' pub='{}'",
        cfg.slot, cfg.publication
    );

    let mut registry = RelationRegistry::new();
    let mut current_lsn = start_lsn;

    loop {
        let mut client = loop {
            match ReplicationClient::connect(cfg.to_replication_config(current_lsn)).await {
                Ok(c) => break c,
                Err(e) if is_slot_active_error(&e) => {
                    eprintln!(
                        "[CDC] slot '{}' held by another process — killing via SQL and retrying",
                        cfg.slot
                    );
                    if let Ok(pg) = plain_client(&cfg).await
                        && let Ok(Some(row)) = pg
                            .query_opt(
                                "SELECT active_pid FROM pg_replication_slots \
                                 WHERE slot_name = $1 AND active_pid IS NOT NULL",
                                &[&cfg.slot],
                            )
                            .await
                    {
                        let pid: i32 = row.get(0);
                        eprintln!("[CDC] terminating blocking PID {pid}");
                        let _ = pg.execute("SELECT pg_terminate_backend($1)", &[&pid]).await;
                    }
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
                Err(e) => return Err(Box::new(e)),
            }
        };

        eprintln!("[CDC] streaming WAL events");
        let result = wal_reader_loop(
            &mut client,
            &mut registry,
            event_tx.clone(),
            &mut lsn_ack_rx,
        )
        .await;

        drop(client);

        match result {
            Ok(()) => eprintln!("[CDC] stream closed by server — reconnecting"),
            Err(e) => eprintln!("[CDC] stream error — reconnecting: {e}"),
        }

        tokio::time::sleep(Duration::from_millis(1_000)).await;
        (current_lsn, _) = ensure_slot(&cfg).await?;
    }
}

fn is_slot_active_error(e: &PgWireError) -> bool {
    matches!(e, PgWireError::Server(msg) if msg.contains(SQLSTATE_OBJECT_IN_USE))
}

// ── Control-plane setup ───────────────────────────────────────────────────────

async fn plain_client(cfg: &AppConfig) -> Result<tokio_postgres::Client, Error> {
    let dsn = format!(
        "host={} port={} user={} password={} dbname={}",
        cfg.host, cfg.port, cfg.user, cfg.password, cfg.database,
    );
    if cfg.ssl_required {
        let connector = TlsConnector::new()?;
        let (client, conn) =
            tokio_postgres::connect(&dsn, MakeTlsConnector::new(connector)).await?;
        tokio::spawn(async move {
            let _ = conn.await;
        });
        Ok(client)
    } else {
        let (client, conn) = tokio_postgres::connect(&dsn, NoTls).await?;
        tokio::spawn(async move {
            let _ = conn.await;
        });
        Ok(client)
    }
}

async fn precheck(cfg: &AppConfig) -> Result<(), Error> {
    let client = plain_client(cfg).await?;

    let row = client.query_one("SHOW wal_level", &[]).await?;
    let wal_level: &str = row.get(0);
    if wal_level != "logical" {
        return Err(format!("wal_level is '{wal_level}'").into());
    }

    Ok(())
}

async fn ensure_slot(cfg: &AppConfig) -> Result<(Lsn, Lsn), Error> {
    let client = plain_client(cfg).await?;

    let existing = client
        .query_opt(
            "SELECT confirmed_flush_lsn::text, restart_lsn::text \
             FROM pg_replication_slots WHERE slot_name = $1",
            &[&cfg.slot],
        )
        .await?;

    let row = if let Some(r) = existing {
        eprintln!("[CDC] slot '{}' already exists — reusing", cfg.slot);
        r
    } else {
        client
            .query_one(
                "SELECT lsn FROM pg_create_logical_replication_slot($1, 'pgoutput')",
                &[&cfg.slot],
            )
            .await
            .map_err(|e| format!("failed to create replication slot '{}': {e}", cfg.slot))?;
        eprintln!("[CDC] created replication slot '{}'", cfg.slot);
        client
            .query_one(
                "SELECT confirmed_flush_lsn::text, restart_lsn::text \
                 FROM pg_replication_slots WHERE slot_name = $1",
                &[&cfg.slot],
            )
            .await?
    };

    let parse_lsn = |col: Option<String>, label: &str| -> Result<Lsn, Error> {
        match col {
            Some(s) => Lsn::parse(&s)
                .map_err(|e| format!("bad {label} LSN from pg_replication_slots: {e}").into()),
            None => Ok(Lsn::ZERO),
        }
    };

    let confirmed: Option<String> = row.get(0);
    let restart: Option<String> = row.get(1);

    let restart_lsn = parse_lsn(restart.clone(), "restart_lsn")?;
    let start_lsn = parse_lsn(confirmed.or(restart), "confirmed_flush_lsn")?;

    eprintln!(
        "[CDC] slot='{}' start_lsn={start_lsn} restart_lsn={restart_lsn}",
        cfg.slot
    );

    if let Some(pid_row) = client
        .query_opt(
            "SELECT active_pid FROM pg_replication_slots \
             WHERE slot_name = $1 AND active_pid IS NOT NULL",
            &[&cfg.slot],
        )
        .await?
    {
        let active_pid: i32 = pid_row.get(0);
        eprintln!(
            "[CDC] slot '{}' held by PID {active_pid} — terminating",
            cfg.slot
        );
        let _ = client
            .execute("SELECT pg_terminate_backend($1)", &[&active_pid])
            .await;
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    Ok((start_lsn, restart_lsn))
}

// ── WAL reader ────────────────────────────────────────────────────────────────

async fn wal_reader_loop(
    client: &mut ReplicationClient,
    registry: &mut RelationRegistry,
    event_tx: mpsc::Sender<WalMessage>,
    lsn_ack_rx: &mut mpsc::UnboundedReceiver<Lsn>,
) -> Result<(), Error> {
    let mut keepalive_count: u64 = 0;

    loop {
        while let Ok(lsn) = lsn_ack_rx.try_recv() {
            client.update_applied_lsn(lsn);
        }

        match client.recv().await? {
            Some(ReplicationEvent::XLogData { wal_end, data, .. }) => {
                let raw = registry.process_message(&data);
                if let Some((topic, key, payload)) = into_kafka_event(raw) {
                    if event_tx
                        .send(WalMessage {
                            lsn: wal_end,
                            topic,
                            key,
                            payload,
                        })
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
            }

            Some(ReplicationEvent::KeepAlive { wal_end, .. }) => {
                keepalive_count += 1;
                if keepalive_count == 1 || keepalive_count.is_multiple_of(12) {
                    eprintln!("[CDC] keepalive #{keepalive_count} wal_end={wal_end}");
                }
                while let Ok(lsn) = lsn_ack_rx.try_recv() {
                    client.update_applied_lsn(lsn);
                }
            }

            Some(ReplicationEvent::Begin { .. }) | Some(ReplicationEvent::Commit { .. }) => {}
            Some(ReplicationEvent::StoppedAt { reached }) => {
                eprintln!("[CDC] stream stopped at LSN {reached}");
                break;
            }
            Some(other) => {
                eprintln!("[CDC] unexpected event: {other:?}");
            }
            None => {
                eprintln!("[CDC] stream closed by server");
                break;
            }
        }
    }
    Ok(())
}

fn into_kafka_event(event: WalEvent) -> Option<(&'static str, String, Vec<u8>)> {
    match event {
        WalEvent::Insert { table, fields } | WalEvent::Update { table, new_fields: fields } => {
            let topic = match table.as_str() {
                "auctions" => auction_kafka::CDC_AUCTIONS_TOPIC,
                "auction_listings" => auction_kafka::CDC_AUCTION_LISTINGS_TOPIC,
                _ => return None,
            };
            let key = fields.get("id")?.as_deref()?.to_string();
            let payload = serde_json::to_vec(&fields).ok()?;
            Some((topic, key, payload))
        }

        WalEvent::Delete { table, key_fields } => {
            let topic = match table.as_str() {
                "auctions" => auction_kafka::CDC_AUCTIONS_TOPIC,
                "auction_listings" => auction_kafka::CDC_AUCTION_LISTINGS_TOPIC,
                _ => return None,
            };
            let key = key_fields.get("id")?.as_deref()?.to_string();
            // Delete payload can be empty or just {"deleted": true}
            let payload = serde_json::json!({"_deleted": true, "id": key}).to_string().into_bytes();
            Some((topic, key, payload))
        }

        _ => None,
    }
}

// ── Publisher task ────────────────────────────────────────────────────────────

async fn publisher_task(
    mut rx: mpsc::Receiver<WalMessage>,
    lsn_ack_tx: mpsc::UnboundedSender<Lsn>,
    producer: rdkafka::producer::FutureProducer,
) {
    while let Some(WalMessage { lsn, topic, key, payload }) = rx.recv().await {
        let mut retries = 0;
        loop {
            match auction_kafka::publish(&producer, topic, &key, &payload).await {
                Ok(_) => break,
                Err(e) => {
                    retries += 1;
                    if retries >= 10 {
                        eprintln!("[CDC] Kafka publish failed (exhausted retries): {e}");
                        break;
                    }
                    eprintln!("[CDC] Kafka publish failed '{e}', retrying ({retries}/10)...");
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                }
            }
        }
        let _ = lsn_ack_tx.send(lsn);
    }
}
