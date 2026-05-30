//! Feature Flags — canary deploy, kill-switch, shadow mode.
//!
//! Stored in DB for cross-instance consistency. Checked per-request
//! with in-memory cache (30s TTL) to avoid DB round-trip on every call.
//!
//! Supports scoping by: user_id, role, percentage rollout.

use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::Utc;

#[derive(Clone, Debug)]
pub struct FeatureFlag {
    pub name: String,
    pub enabled: bool,
    /// Percentage of users who see this feature (0-100). NULL = all or none.
    pub rollout_percentage: Option<i32>,
    /// Comma-separated list of roles that have access (e.g., "admin,brand")
    pub allowed_roles: Option<String>,
    /// If true, feature computes but doesn't render (shadow mode)
    pub shadow_mode: bool,
}

pub struct FeatureFlagService {
    pool: PgPool,
    cache: Arc<RwLock<HashMap<String, FeatureFlag>>>,
    cache_loaded_at: Arc<RwLock<Option<chrono::DateTime<Utc>>>>,
}

impl FeatureFlagService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            cache: Arc::new(RwLock::new(HashMap::new())),
            cache_loaded_at: Arc::new(RwLock::new(None)),
        }
    }

    /// Check if a feature is enabled for a given user context.
    pub async fn is_enabled(
        &self,
        flag_name: &str,
        user_id: Option<i64>,
        role: Option<&str>,
    ) -> bool {
        self.refresh_cache_if_stale().await;

        let cache = self.cache.read().await;
        let flag = match cache.get(flag_name) {
            Some(f) => f.clone(),
            None => return false, // Unknown flag = disabled
        };

        if !flag.enabled {
            return false;
        }

        // Role check
        if let Some(allowed) = &flag.allowed_roles {
            if let Some(r) = role {
                if !allowed.split(',').any(|a| a.trim() == r) {
                    return false;
                }
            } else {
                return false; // No role provided but flag requires one
            }
        }

        // Percentage rollout (deterministic: hash user_id)
        if let (Some(pct), Some(uid)) = (flag.rollout_percentage, user_id) {
            let bucket = (uid % 100) as i32;
            return bucket < pct;
        }

        true
    }

    /// Check if feature is in shadow mode (compute but don't render).
    pub async fn is_shadow(&self, flag_name: &str) -> bool {
        self.refresh_cache_if_stale().await;
        let cache = self.cache.read().await;
        cache.get(flag_name).map(|f| f.shadow_mode).unwrap_or(false)
    }

    /// Kill-switch: immediately disable a feature across all instances.
    pub async fn kill(&self, flag_name: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE feature_flags SET enabled = FALSE, updated_at = NOW() WHERE name = $1"
        )
        .bind(flag_name)
        .execute(&self.pool)
        .await?;

        // Force cache refresh
        *self.cache_loaded_at.write().await = None;
        Ok(())
    }

    /// Set rollout percentage (canary deploy).
    pub async fn set_rollout(
        &self,
        flag_name: &str,
        percentage: i32,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE feature_flags SET rollout_percentage = $2, updated_at = NOW() WHERE name = $1"
        )
        .bind(flag_name)
        .bind(percentage.clamp(0, 100))
        .execute(&self.pool)
        .await?;

        *self.cache_loaded_at.write().await = None;
        Ok(())
    }

    async fn refresh_cache_if_stale(&self) {
        let loaded = *self.cache_loaded_at.read().await;
        let stale = match loaded {
            Some(t) => Utc::now().signed_duration_since(t).num_seconds() > 30,
            None => true,
        };

        if !stale {
            return;
        }

        let flags: Vec<(String, bool, Option<i32>, Option<String>, bool)> = match sqlx::query_as(
            "SELECT name, enabled, rollout_percentage, allowed_roles, shadow_mode
             FROM feature_flags WHERE deleted_at IS NULL"
        )
        .fetch_all(&self.pool)
        .await
        {
            Ok(rows) => rows,
            Err(_) => return, // DB failure — keep stale cache
        };

        let mut cache = self.cache.write().await;
        cache.clear();
        for (name, enabled, pct, roles, shadow) in flags {
            cache.insert(name.clone(), FeatureFlag {
                name,
                enabled,
                rollout_percentage: pct,
                allowed_roles: roles,
                shadow_mode: shadow,
            });
        }
        *self.cache_loaded_at.write().await = Some(Utc::now());
    }
}
