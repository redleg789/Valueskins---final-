//! Read Replica Router
//!
//! Routes read-heavy queries (analytics, reputation lookups, application counts)
//! to read replicas, keeping the primary for writes only.
//!
//! At Meta scale: primary handles 500K writes/sec. Without read replica routing,
//! 10M reads/sec compete for the same connection pool → cascading timeouts.
//!
//! Usage:
//!   let pool = replica_router.read_pool();  // for SELECT queries
//!   let pool = replica_router.write_pool(); // for INSERT/UPDATE/DELETE

use sqlx::postgres::PgPool;

#[derive(Clone)]
pub struct ReplicaRouter {
    /// Primary pool — all writes go here
    primary: PgPool,
    /// Read replica pool — analytics, reputation, listing queries
    /// Falls back to primary if replica is unavailable
    replica: Option<PgPool>,
}

impl ReplicaRouter {
    /// Create with primary only (single-DB deployments)
    pub fn primary_only(pool: PgPool) -> Self {
        Self {
            primary: pool,
            replica: None,
        }
    }

    /// Create with primary + read replica
    pub fn with_replica(primary: PgPool, replica: PgPool) -> Self {
        Self {
            primary,
            replica: Some(replica),
        }
    }

    /// Get pool for write operations (INSERT, UPDATE, DELETE)
    pub fn write_pool(&self) -> &PgPool {
        &self.primary
    }

    /// Get pool for read operations — uses replica if available, else primary
    pub fn read_pool(&self) -> &PgPool {
        self.replica.as_ref().unwrap_or(&self.primary)
    }

    /// Get primary pool directly (for transactions that mix reads+writes)
    pub fn primary(&self) -> &PgPool {
        &self.primary
    }

    /// Check if replica is configured
    pub fn has_replica(&self) -> bool {
        self.replica.is_some()
    }
}
