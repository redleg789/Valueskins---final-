// Database read replica router for scaling read-heavy workloads
// Routes reads to replicas, writes to primary

use std::sync::Arc;
use sqlx::PgPool;
use tokio::sync::RwLock;

/// Manages primary + read replica connections
pub struct DbRouter {
    primary: PgPool,
    read_replicas: Arc<RwLock<Vec<PgPool>>>,
    replica_index: Arc<std::sync::atomic::AtomicUsize>,
}

impl DbRouter {
    /// Create with primary + read replicas
    pub fn new(
        primary_url: &str,
        replica_urls: &[&str],
    ) -> Self {
        let runtime = tokio::runtime::Handle::current();
        
        // Primary connection
        let primary = runtime.block_on(async {
            PgPool::connect(primary_url).await
        }).expect("Failed to connect to primary");
        
        // Read replica connections
        let read_replicas = runtime.block_on(async {
            let mut replicas = Vec::new();
            for url in replica_urls {
                match PgPool::connect(url).await {
                    Ok(pool) => replicas.push(pool),
                    Err(e) => tracing::warn!("Failed to connect to replica: {}", e),
                }
            }
            Ok::<_, sqlx::Error>(replicas)
        }).expect("Failed to connect to replicas");
        
        Self {
            primary: Arc::new(primary),
            read_replicas: Arc::new(RwLock::new(read_replicas)),
            replica_index: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        }
    }

    /// Get read replica (round-robin)
    pub async fn read(&self) -> PgPool {
        let replicas = self.read_replicas.read().await;
        
        if replicas.is_empty() {
            return self.primary.clone();
        }
        
        let idx = self.replica_index.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let pool = &replicas[idx % replicas.len()];
        pool.clone()
    }

    /// Get primary (for writes)
    pub fn write(&self) -> PgPool {
        self.primary.clone()
    }

    /// Execute read query on replica
    pub async fn read_query<T, F, R>(&self, f: F) -> Result<R, sqlx::Error>
    where
        F: std::future::Future<Output = Result<R, sqlx::Error>>,
    {
        let pool = self.read().await;
        f.await
    }

    /// Execute write on primary
    pub async fn write_query<T, F, R>(&self, f: F) -> Result<R, sqlx::Error>
    where
        F: std::future::Future<Output = Result<R, sqlx::Error>>,
    {
        f(self.primary.clone()).await
    }
}

/// Query builder extensions for read/write splitting
pub trait ReadWriteSplit {
    async fn read<T: for<'de> sqlx::FromRow<'de, sqlx::postgres::PgRow>>(
        &self,
    ) -> Result<Option<T>, sqlx::Error>;
    
    async fn read_all<T: for<'de> sqlx::FromRow<'de, sqlx::postgres::PgRow>>(
        &self,
    ) -> Result<Vec<T>, sqlx::Error>;
    
    async fn write(
        &self,
    ) -> Result<sqlx::postgres::PgQueryResult, sqlx::Error>;
}

impl ReadWriteSplit for DbRouter {
    async fn read<T: for<'de> sqlx::FromRow<'de, sqlx::postgres::PgRow>>(
        &self,
    ) -> Result<Option<T>, sqlx::Error> {
        let pool = self.read().await;
        sqlx::query_as::<_, T>("").fetch_optional(&pool).await
    }
    
    async fn read_all<T: for<'de> sqlx::FromRow<'de, sqlx::postgres::PgRow>>(
        &self,
    ) -> Result<Vec<T>, sqlx::Error> {
        let pool = self.read().await;
        sqlx::query_as::<_, T>("").fetch_all(&pool).await
    }
    
    async fn write(
        &self,
    ) -> Result<sqlx::postgres::PgQueryResult, sqlx::Error> {
        sqlx::query("").execute(&self.primary).await
    }
}

/// Prepared statement cache for replicas
pub struct StatementCache {
    prepared: Arc<RwLock<std::collections::HashMap<String, sqlx::postgres::PgStatement<'static>>>>,
}

impl StatementCache {
    pub fn new() -> Self {
        Self {
            prepared: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    pub async fn get(&self, sql: &str, pool: &PgPool) -> Result<sqlx::postgres::PgStatement, sqlx::Error> {
        let cache = self.prepared.read().await;
        
        if let Some(stmt) = cache.get(sql) {
            return Ok(stmt.clone());
        }
        
        let stmt = pool.prepare(sql).await?;
        
        // Cache it
        let mut cache = self.prepared.write().await;
        cache.insert(sql.to_string(), stmt.clone());
        
        Ok(stmt)
    }
}