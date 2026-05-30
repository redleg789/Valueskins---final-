use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

/// Creates a production-grade connection pool.
///
/// max_connections=5 is a death sentence at scale. A single Actix worker
/// with 5 connections serving 1000 req/s means 200ms avg wait just for
/// a connection. At Meta scale this causes cascading timeouts.
///
/// Default of 50 supports:
/// - 16 Actix workers × 50 connections = 800 total (safe for PostgreSQL)
/// - Each worker can handle 1-2 req/ms with realistic 5-10ms query times
/// - Spare capacity for connection reuse and transaction ordering
///
/// The pool size is configurable via DATABASE_POOL_SIZE env var.
/// Production should tune: (num_workers * pool_size) < 85% of PostgreSQL max_connections.
pub async fn get_db_pool(connection_string: &str) -> Result<PgPool, sqlx::Error> {
    let pool_size: u32 = std::env::var("DATABASE_POOL_SIZE")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(50);

    PgPoolOptions::new()
        .max_connections(pool_size)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(600))
        .max_lifetime(Duration::from_secs(1800))
        .connect(connection_string)
        .await
}
