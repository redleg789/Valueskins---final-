// Aggressive multi-layer caching for 100K+ users
// Caches: profiles, deals, listings, search results, user sessions

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

use crate::redis_pool::{RedisPool, RedisPoolError};

/// Multi-layer cache configuration
#[derive(Debug, Clone)]
pub struct CacheConfig {
    // Profile caching
    pub profile_ttl: Duration,
    pub profile_cache_any: bool,
    
    // Deal caching  
    pub deal_ttl: Duration,
    pub deal_cache_any: bool,
    
    // Listing caching
    pub listings_ttl: Duration,
    pub listings_cache_any: bool,
    
    // Query result caching
    pub query_ttl: Duration,
    pub query_max_size: usize,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            // Profiles: cache for 5 minutes minimum
            profile_ttl: Duration::from_secs(300),
            profile_cache_any: true,
            
            // Deals: cache for 1 minute (fresher data needed)
            deal_ttl: Duration::from_secs(60),
            deal_cache_any: true,
            
            // Listings: cache for 30 seconds
            listings_ttl: Duration::from_secs(30),
            listings_cache_any: true,
            
            // Query results: cache for 30 seconds max
            query_ttl: Duration::from_secs(30),
            query_max_size: 10_000, // 10K entries max per query
        }
    }
}

/// Aggressive cache for 100K user platform
pub struct AggressiveCache {
    redis: RedisPool,
    config: CacheConfig,
    local: Arc<RwLock<lru::LruCache<String, serde_json::Value>>>,
}

impl AggressiveCache {
    pub fn new(redis: RedisPool) -> Self {
        Self {
            redis,
            config: CacheConfig::default(),
            local: Arc::new(RwLock::new(lru::LruCache::new(100_000))),
        }
    }

    /// Cache a user profile
    pub async fn cache_profile<T: Serialize>(&self, user_id: &str, profile: &T) -> RedisPoolError {
        let key = format!("profile:{}", user_id);
        self.redis.set(&key, profile, self.config.profile_ttl).await
    }

    /// Get cached profile (check local first)
    pub async fn get_profile<T: for<'de> Deserialize<'de>>(&self, user_id: &str) -> Result<Option<T>, RedisPoolError> {
        // Check local cache first (fast)
        {
            let local = self.local.read().await;
            if let Somecached) = local.get(&format!("profile:{}", user_id)) {
                return Ok(Some(serde_json::from_value(cached.clone()).ok()?));
            }
        }
        
        // Check Redis
        let key = format!("profile:{}", user_id);
        let result: Option<T> = self.redis.get(&key).await?;
        
        // Populate local cache if found
        if let Some(ref profile) = result {
            let mut local = self.local.write().await;
            local.put(
                format!("profile:{}", user_id),
                serde_json::to_value(profile).unwrap_or_default(),
            );
        }
        
        Ok(result)
    }

    /// Invalidate profile
    pub async fn invalidate_profile(&self, user_id: &str) -> RedisPoolError {
        // Remove from local
        {
            let mut local = self.local.write().await;
            local.remove(&format!("profile:{}", user_id));
        }
        
        // Remove from Redis
        let key = format!("profile:{}", user_id);
        self.redis.delete(&key).await
    }

    /// Cache a deal
    pub async fn cache_deal<T: Serialize>(&self, deal_id: i64, deal: &T) -> RedisPoolError {
        let key = format!("deal:{}", deal_id);
        self.redis.set(&key, deal, self.config.deal_ttl).await
    }

    /// Get cached deal
    pub async fn get_deal<T: for<'de> Deserialize<'de>>(&self, deal_id: i64) -> Result<Option<T>, RedisPoolError> {
        let key = format!("deal:{}", deal_id);
        self.redis.get(&key).await
    }

    /// Invalidate deal
    pub async fn invalidate_deal(&self, deal_id: i64) -> RedisPoolError {
        let key = format!("deal:{}", deal_id);
        self.redis.delete(&key).await
    }

    /// Cache deal listings (list of IDs)
    pub async fn cache_deal_list(&self, key_suffix: &str, deals: &[i64]) -> RedisPoolError {
        let key = format!("deals:list:{}", key_suffix);
        self.redis.set(&key, &deals, self.config.listings_ttl).await
    }

    /// Get cached deal list
    pub async fn get_deal_list(&self, key_suffix: &str) -> Result<Option<Vec<i64>>, RedisPoolError> {
        let key = format!("deals:list:{}", key_suffix);
        self.redis.get(&key).await
    }

    /// Cache query results (expensive searches)
    pub async fn cache_query_result<T: Serialize>(
        &self,
        query_hash: &str,
        results: &[T],
    ) -> RedisPoolError {
        // Don't cache large results
        if results.len() > self.config.query_max_size {
            return Ok(());
        }
        
        let key = format!("query:{}", query_hash);
        self.redis.set(&key, results, self.config.query_ttl).await
    }

    /// Get cached query results
    pub async fn get_query_results<T: for<'de> Deserialize<'de>>(
        &self,
        query_hash: &str,
    ) -> Result<Option<Vec<T>>, RedisPoolError> {
        let key = format!("query:{}", query_hash);
        self.redis.get(&key).await
    }

    /// Warm up cache with popular data (run on startup)
    pub async fn warm_up(&self) {
        // Warm popular profiles
        let _ = self.warm_profiles().await;
        
        // Warm featured deals
        let _ = self.warm_deals().await;
    }

    async fn warm_profiles(&self) -> Result<(), RedisPoolError> {
        // Get from DB and cache (this would query primary DB)
        // For now just log
        tracing::info!("Cache warming: popular profiles");
        Ok(())
    }

    async fn warm_deals(&self) -> Result<(), RedisPoolError> {
        tracing::info!("Cache warming: featured deals");
        Ok(())
    }
}

/// Preload service - loads hot data into cache on startup
pub struct CacheWarmer {
    cache: AggressiveCache,
}

impl CacheWarmer {
    pub fn new(cache: AggressiveCache) -> Self {
        Self { cache }
    }

    /// Start background cache warming
    pub fn start_background(&self) {
        let cache = self.cache.clone();
        
        tokio::spawn(async move {
            // Initial warm
            cache.warm_up().await;
            
            // Refresh every 30 seconds
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            
            loop {
                interval.tick().await;
                let _ = cache.warm_up().await;
            }
        });
    }
}

impl Clone for AggressiveCache {
    fn clone(&self) -> Self {
        Self {
            redis: self.redis.clone(),
            config: self.config.clone(),
            local: self.local.clone(),
        }
    }
}

impl Clone for CacheWarmer {
    fn clone(&self) -> Self {
        Self {
            cache: self.cache.clone(),
        }
    }
}