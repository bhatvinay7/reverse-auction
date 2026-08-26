pub mod models;
pub mod schema;

use diesel::r2d2::{ConnectionManager, Pool};
use diesel::PgConnection;

pub fn get_connection_pool() -> Pool<ConnectionManager<PgConnection>> {
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/auction".to_string());
    let mut db_retry = 1;
    loop {
        let manager = ConnectionManager::<PgConnection>::new(db_url.clone());
        match Pool::builder().build(manager) {
            Ok(p) => break p,
            Err(e) => {
                eprintln!(
                    "Failed to connect to DB: {:?}. Retrying in {}s...",
                    e, db_retry
                );
                std::thread::sleep(std::time::Duration::from_secs(db_retry));
                db_retry = std::cmp::min(db_retry * 2, 60);
            }
        }
    }
}
