//! PlatformConfigService — reads `platform_config` table with a 30s in-memory cache.
//!
//! Used by:
//!  - Maintenance mode middleware (returns 503 when enabled)
//!  - Feature-specific handlers checking enable_* flags before processing requests
//!
//! Cache avoids a DB round-trip on every request. Cache invalidates after 30s
//! or on explicit `invalidate()` call (e.g., after admin panel updates the config).

use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};

#[derive(Clone, Debug, Default)]
pub struct PlatformConfigSnapshot {
    pub maintenance_mode_enabled: bool,
    pub maintenance_mode_message: String,
    pub enable_kyc: bool,
    pub enable_campaign_gating: bool,
    pub enable_communities: bool,
    pub enable_dispute_resolution: bool,
    pub enable_brand_verification: bool,
    pub enable_csuite_advantage: bool,
    pub platform_fee_percentage: f64,
    pub max_creator_applications_per_day: i32,
    pub max_brand_opportunities_per_day: i32,
}

struct CacheState {
    snapshot: PlatformConfigSnapshot,
    loaded_at: Option<DateTime<Utc>>,
}

const CACHE_TTL_SECS: i64 = 30;

pub struct PlatformConfigService {
    pool: PgPool,
    cache: Arc<RwLock<CacheState>>,
}

impl PlatformConfigService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            cache: Arc::new(RwLock::new(CacheState {
                snapshot: PlatformConfigSnapshot::default(),
                loaded_at: None,
            })),
        }
    }

    /// Force the cache to reload on next access (call after admin updates config).
    pub async fn invalidate(&self) {
        self.cache.write().await.loaded_at = None;
    }

    /// Get the current platform config snapshot (cache-first).
    pub async fn get(&self) -> PlatformConfigSnapshot {
        self.refresh_if_stale().await;
        self.cache.read().await.snapshot.clone()
    }

    /// Convenience: is the platform in maintenance mode right now?
    pub async fn is_maintenance(&self) -> (bool, String) {
        let s = self.get().await;
        (s.maintenance_mode_enabled, s.maintenance_mode_message)
    }

    /// Convenience: is a feature flag enabled?
    pub async fn feature_enabled(&self, flag: PlatformFlag) -> bool {
        let s = self.get().await;
        match flag {
            PlatformFlag::Kyc                => s.enable_kyc,
            PlatformFlag::CampaignGating     => s.enable_campaign_gating,
            PlatformFlag::Communities        => s.enable_communities,
            PlatformFlag::DisputeResolution  => s.enable_dispute_resolution,
            PlatformFlag::BrandVerification  => s.enable_brand_verification,
            PlatformFlag::CsuiteAdvantage    => s.enable_csuite_advantage,
        }
    }

    async fn refresh_if_stale(&self) {
        let stale = {
            let state = self.cache.read().await;
            match state.loaded_at {
                Some(t) => Utc::now().signed_duration_since(t).num_seconds() > CACHE_TTL_SECS,
                None => true,
            }
        };
        if !stale { return; }

        let row: Option<(bool, String, bool, bool, bool, bool, bool, bool, f64, i32, i32)> =
            sqlx::query_as(
                "SELECT maintenance_mode_enabled, maintenance_mode_message,
                        enable_kyc, enable_campaign_gating, enable_communities,
                        enable_dispute_resolution, enable_brand_verification,
                        enable_csuite_advantage, platform_fee_percentage,
                        max_creator_applications_per_day, max_brand_opportunities_per_day
                 FROM platform_config WHERE id = 1"
            )
            .fetch_optional(&self.pool)
            .await
            .unwrap_or(None);

        if let Some((mm, mm_msg, kyc, camp, comm, disp, brand, csuite, fee, max_c, max_b)) = row {
            let mut state = self.cache.write().await;
            state.snapshot = PlatformConfigSnapshot {
                maintenance_mode_enabled: mm,
                maintenance_mode_message: mm_msg,
                enable_kyc: kyc,
                enable_campaign_gating: camp,
                enable_communities: comm,
                enable_dispute_resolution: disp,
                enable_brand_verification: brand,
                enable_csuite_advantage: csuite,
                platform_fee_percentage: fee,
                max_creator_applications_per_day: max_c,
                max_brand_opportunities_per_day: max_b,
            };
            state.loaded_at = Some(Utc::now());
        }
        // On DB failure: keep stale snapshot — degraded but available
    }
}

/// Enum of platform-level feature flags stored in `platform_config`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlatformFlag {
    Kyc,
    CampaignGating,
    Communities,
    DisputeResolution,
    BrandVerification,
    CsuiteAdvantage,
}
