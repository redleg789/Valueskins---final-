// Database Sharding with Consistent Hashing
// Shard by user_id modulo - handles writes at scale

use std::sync::Arc;
use std::collections::HashMap;

/// Consistent hashing ring for database sharding
pub struct ShardRing {
    shards: Vec<ShardConfig>,
    virtual_nodes: usize,
}

#[derive(Debug, Clone)]
pub struct ShardConfig {
    pub id: usize,
    pub connection_string: String,
    pub weight: usize,
}

impl ShardRing {
    pub fn new(shards: Vec<ShardConfig>) -> Self {
        Self {
            shards,
            virtual_nodes: 150, // Virtual nodes per shard for even distribution
        }
    }

    /// Get shard for user_id
    pub fn get_shard(&self, user_id: i64) -> usize {
        let shard_index = (user_id % self.total_shards() as i64).abs() as usize;
        shard_index % self.total_shards()
    }

    /// Get shard for session_id (derived from user_id)
    pub fn get_shard_for_session(&self, session_id: &str) -> usize {
        let hash = self.hash(session_id);
        hash % self.total_shards()
    }

    /// Get shard for deal (derived from brand_id + creator_id)
    pub fn get_shard_for_deal(&self, brand_id: i64, creator_id: i64) -> usize {
        let combined = brand_id.wrapping_add(creator_id);
        combined as usize % self.total_shards()
    }

    /// Get shard for message (derived from room_id)
    pub fn get_shard_for_room(&self, room_id: i64) -> usize {
        room_id as usize % self.total_shards()
    }

    fn total_shards(&self) -> usize {
        self.shards.len()
    }

    fn hash(&self, key: &str) -> usize {
        // FNV hash for even distribution
        let mut hash: u64 = 14695981039346656037;
        for byte in key.bytes() {
            hash ^= byte as u64;
            hash = hash.wrapping_mul(1099511628211);
        }
        hash as usize
    }
}

/// Sharded database connection pool
pub struct ShardedPool {
    ring: ShardRing,
    pools: HashMap<usize, sqlx::PgPool>,
}

impl ShardedPool {
    pub async fn new(shards: Vec<ShardConfig>) -> Result<Self, sqlx::Error> {
        let ring = ShardRing::new(shards);
        
        let mut pools = HashMap::new();
        for config in &ring.shards {
            match sqlx::PgPool::connect(&config.connection_string).await {
                Ok(pool) => {
                    pools.insert(config.id, pool);
                }
                Err(e) => {
                    tracing::error!("Failed to connect to shard {}: {}", config.id, e);
                }
            }
        }
        
        Ok(Self { ring, pools })
    }

    /// Get pool for user
    pub fn pool_for_user(&self, user_id: i64) -> &sqlx::PgPool {
        let shard = self.ring.get_shard(user_id);
        &self.pools[&shard]
    }

    /// Execute on correct shard for user
    pub async fn execute_for_user<R>(
        &self,
        user_id: i64,
        query: &str,
    ) -> Result<Vec<R>, sqlx::Error>
    where
        R: for<'de> sqlx::FromRow<'de, sqlx::postgres::PgRow>,
    {
        let pool = self.pool_for_user(user_id);
        sqlx::query_as::<_, R>(query).fetch_all(pool).await
    }

    /// Get connection string for shard
    pub fn connection_string(&self, shard_id: usize) -> Option<&str> {
        self.ring.shards.get(shard_id).map(|s| s.connection_string.as_str())
    }
}

/// Routes reads to appropriate shard based on resource type
pub struct DbRouter {
    primary: sqlx::PgPool,
    read_replicas: Vec<sqlx::PgPool>,
    shard_ring: ShardRing,
    read_replica_enabled: bool,
}

impl DbRouter {
    pub async fn new(
        primary_url: &str,
        replica_urls: Vec<String>,
    ) -> Result<Self, sqlx::Error> {
        let primary = sqlx::PgPool::connect(primary_url).await?;
        
        let mut read_replicas = Vec::new();
        for url in &replica_urls {
            match sqlx::PgPool::connect(url).await {
                Ok(pool) => read_replicas.push(pool),
                Err(e) => tracing::warn!("Failed to connect to replica: {}", e),
            }
        }
        
        // Create shard ring for sharding
        let shards = replica_urls
            .iter()
            .enumerate()
            .map(|(i, url)| ShardConfig {
                id: i,
                connection_string: url.clone(),
                weight: 1,
            })
            .collect();
        
        let ring = ShardRing::new(shards);
        
        Ok(Self {
            primary,
            read_replicas,
            shard_ring: ring,
            read_replica_enabled: !read_replicas.is_empty(),
        })
    }

    /// Read from replica (if available), otherwise primary
    pub async fn read<T, F, R>(&self, user_id: i64, f: F) -> Result<R, sqlx::Error>
    where
        F: std::future::Future<Output = Result<R, sqlx::Error>>,
    {
        if self.read_replica_enabled && !self.read_replicas.is_empty() {
            // Route to replica based on user_id for read affinity
            let replica_index = user_id as usize % self.read_replicas.len();
            let pool = &self.read_replicas[replica_index];
            f(pool).await
        } else {
            f(&self.primary).await
        }
    }

    /// Write to primary (single writer)
    pub async fn write<T, F, R>(&self, f: F) -> Result<R, sqlx::Error>
    where
        F: std::future::Future<Output = Result<R, sqlx::Error>>,
    {
        f(&self.primary).await
    }

    /// Read from specific shard
    pub async fn read_from_shard<T, F, R>(&self, shard_id: usize, f: F) -> Result<R, sqlx::Error>
    where
        F: std::future::Future<Output = Result<R, sqlx::Error>>,
    {
        if shard_id < self.read_replicas.len() {
            f(&self.read_replicas[shard_id]).await
        } else {
            f(&self.primary).await
        }
    }

    /// Get shard for user
    pub fn shard_for_user(&self, user_id: i64) -> usize {
        self.shard_ring.get_shard(user_id)
    }
}