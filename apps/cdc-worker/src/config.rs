use pgwire_replication::{ReplicationConfig, TlsConfig};
use std::time::Duration;

pub struct AppConfig {
    pub slot: String,
    pub publication: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub database: String,
    pub ssl_required: bool,
    pub tls: TlsConfig,
}

impl AppConfig {
    pub fn from_env() -> Self {
        let raw_url = std::env::var("REPLICATION_URL")
            .or_else(|_| std::env::var("DATABASE_URL"))
            .expect("REPLICATION_URL or DATABASE_URL must be set");
        let raw_url = raw_url.trim().trim_matches('\'').trim_matches('"');

        let (host, port, user, password, database, ssl_required) =
            parse_pg_url(raw_url).expect("Failed to parse database URL");

        let tls = if ssl_required {
            TlsConfig::require()
        } else {
            TlsConfig::disabled()
        };

        Self {
            slot: std::env::var("CDC_SLOT_NAME").unwrap_or_else(|_| "auction_cdc_slot".into()),
            publication: std::env::var("CDC_PUBLICATION")
                .unwrap_or_else(|_| "auction_cdc_pub".into()),
            host,
            port,
            user,
            password,
            database,
            ssl_required,
            tls,
        }
    }

    pub fn to_replication_config(&self, start_lsn: pgwire_replication::Lsn) -> ReplicationConfig {
        ReplicationConfig {
            host: self.host.clone(),
            port: self.port,
            user: self.user.clone(),
            password: self.password.clone(),
            database: self.database.clone(),
            tls: self.tls.clone(),
            slot: self.slot.clone(),
            publication: self.publication.clone(),
            start_lsn,
            stop_at_lsn: None,
            // Send standby status updates every 5 s; idle wakeup also every 5 s so
            // the loop never blocks longer than that without sending a keepalive.
            // Keeps us well under any wal_sender_timeout (PG default 60 s).
            status_interval: Duration::from_secs(5),
            idle_wakeup_interval: Duration::from_secs(5),
            buffer_events: 4096,
        }
    }
}

fn parse_pg_url(url: &str) -> Option<(String, u16, String, String, String, bool)> {
    let url = url
        .trim_start_matches("postgresql://")
        .trim_start_matches("postgres://");

    let (userinfo, rest) = url.split_once('@')?;
    let (user, pass) = userinfo.split_once(':')?;

    let (host_part, db_and_params) = rest.split_once('/')?;
    let (db, params) = db_and_params.split_once('?').unwrap_or((db_and_params, ""));

    let (host, port) = if let Some(colon) = host_part.rfind(':') {
        let port: u16 = host_part[colon + 1..].parse().unwrap_or(5432);
        (&host_part[..colon], port)
    } else {
        (host_part, 5432)
    };

    let ssl = params.contains("sslmode=require")
        || params.contains("sslmode=verify-ca")
        || params.contains("sslmode=verify-full");

    Some((
        host.to_string(),
        port,
        user.to_string(),
        pass.to_string(),
        db.to_string(),
        ssl,
    ))
}
