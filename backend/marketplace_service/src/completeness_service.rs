//! Creator Onboarding Completeness Service
//!
//! Computes a 0-100 completeness score for each creator profile.
//! Score drives: search ranking boost, trust display, onboarding nudges.
//!
//! Scoring components (each adds points when present):
//!   has_avatar      → 15 pts
//!   has_bio         → 15 pts
//!   has_valueskin   → 20 pts  (core product requirement)
//!   has_price_band  → 10 pts
//!   has_credential  → 15 pts  (GitHub/LinkedIn linked)
//!   has_testimonial → 15 pts  (received at least 1 verified)
//!   has_barter_pref → 5 pts
//!   has_energy_state → 5 pts
//!   Total max: 100 pts
//!
//! Tier thresholds:
//!   0-39:   incomplete
//!   40-69:  developing
//!   70-89:  established
//!   90-100: elite

use sqlx::PgPool;

pub struct CompletenessService {
    pool: PgPool,
}

#[derive(Debug, serde::Serialize)]
pub struct CompletenessResult {
    pub user_id: i64,
    pub completeness_score: i32,
    pub completeness_tier: String,
    pub has_avatar: bool,
    pub has_bio: bool,
    pub has_valueskin: bool,
    pub has_price_band: bool,
    pub has_credential: bool,
    pub has_testimonial: bool,
    pub has_barter_pref: bool,
    pub has_energy_state: bool,
    /// Ordered list of next steps to improve score
    pub next_steps: Vec<String>,
}

impl CompletenessResult {
    fn compute_next_steps(&self) -> Vec<String> {
        let mut steps = Vec::new();
        if !self.has_valueskin   { steps.push("Add your first ValueSkin profession".to_string()); }
        if !self.has_avatar      { steps.push("Upload a profile photo".to_string()); }
        if !self.has_bio         { steps.push("Write a bio (tell brands who you are)".to_string()); }
        if !self.has_credential  { steps.push("Link a credential (GitHub, LinkedIn, portfolio)".to_string()); }
        if !self.has_testimonial { steps.push("Complete a deal to earn your first testimonial".to_string()); }
        if !self.has_price_band  { steps.push("Set your price band".to_string()); }
        if !self.has_barter_pref { steps.push("Set your barter preference".to_string()); }
        if !self.has_energy_state { steps.push("Set your availability state".to_string()); }
        steps
    }
}

#[derive(Debug)]
pub enum CompletenessError {
    Database(sqlx::Error),
}

impl From<sqlx::Error> for CompletenessError {
    fn from(e: sqlx::Error) -> Self {
        CompletenessError::Database(e)
    }
}

impl CompletenessService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Compute and store completeness score for a user.
    /// Idempotent — safe to call repeatedly.
    pub async fn compute_and_store(
        &self,
        user_id: i64,
    ) -> Result<CompletenessResult, CompletenessError> {
        // Single query joining all signal tables to avoid N+1
        let row = sqlx::query(
            r#"
            SELECT
                u.avatar_url IS NOT NULL AND u.avatar_url != '' AS has_avatar,
                u.bio IS NOT NULL AND LENGTH(TRIM(u.bio)) > 10 AS has_bio,
                EXISTS(
                    SELECT 1 FROM persona_professions pp
                    JOIN personas p ON pp.persona_id = p.id
                    WHERE p.owner_user_id = u.id AND pp.is_hidden = FALSE
                ) AS has_valueskin,
                COALESCE(us.price_band, '') != '' AS has_price_band,
                EXISTS(
                    SELECT 1 FROM creator_credentials WHERE user_id = u.id AND is_active = TRUE
                ) AS has_credential,
                EXISTS(
                    SELECT 1 FROM testimonials WHERE creator_user_id = u.id AND status = 'approved'
                ) AS has_testimonial,
                us.willing_to_barter IS NOT NULL AS has_barter_pref,
                COALESCE(us.energy_state, '') != '' AS has_energy_state
            FROM users u
            LEFT JOIN user_settings us ON u.id = us.user_id
            WHERE u.id = $1
            "#
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        let row = match row {
            Some(r) => r,
            None => return Err(CompletenessError::Database(sqlx::Error::RowNotFound)),
        };

        use sqlx::Row;
        let has_avatar:      bool = row.try_get("has_avatar").unwrap_or(false);
        let has_bio:         bool = row.try_get("has_bio").unwrap_or(false);
        let has_valueskin:   bool = row.try_get("has_valueskin").unwrap_or(false);
        let has_price_band:  bool = row.try_get("has_price_band").unwrap_or(false);
        let has_credential:  bool = row.try_get("has_credential").unwrap_or(false);
        let has_testimonial: bool = row.try_get("has_testimonial").unwrap_or(false);
        let has_barter_pref: bool = row.try_get("has_barter_pref").unwrap_or(false);
        let has_energy_state: bool = row.try_get("has_energy_state").unwrap_or(false);

        let score = (if has_avatar { 15 } else { 0 })
            + (if has_bio { 15 } else { 0 })
            + (if has_valueskin { 20 } else { 0 })
            + (if has_price_band { 10 } else { 0 })
            + (if has_credential { 15 } else { 0 })
            + (if has_testimonial { 15 } else { 0 })
            + (if has_barter_pref { 5 } else { 0 })
            + (if has_energy_state { 5 } else { 0 });

        let tier = match score {
            90..=100 => "elite",
            70..=89  => "established",
            40..=69  => "developing",
            _        => "incomplete",
        };

        // Upsert into creator_completeness for fast reads
        sqlx::query(
            r#"
            INSERT INTO creator_completeness
                (user_id, has_avatar, has_bio, has_valueskin, has_price_band,
                 has_credential, has_testimonial, has_barter_pref, has_energy_state,
                 completeness_score, completeness_tier, last_computed_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                has_avatar = EXCLUDED.has_avatar,
                has_bio = EXCLUDED.has_bio,
                has_valueskin = EXCLUDED.has_valueskin,
                has_price_band = EXCLUDED.has_price_band,
                has_credential = EXCLUDED.has_credential,
                has_testimonial = EXCLUDED.has_testimonial,
                has_barter_pref = EXCLUDED.has_barter_pref,
                has_energy_state = EXCLUDED.has_energy_state,
                completeness_score = EXCLUDED.completeness_score,
                completeness_tier = EXCLUDED.completeness_tier,
                last_computed_at = NOW()
            "#
        )
        .bind(user_id)
        .bind(has_avatar)
        .bind(has_bio)
        .bind(has_valueskin)
        .bind(has_price_band)
        .bind(has_credential)
        .bind(has_testimonial)
        .bind(has_barter_pref)
        .bind(has_energy_state)
        .bind(score)
        .bind(tier)
        .execute(&self.pool)
        .await?;

        let mut result = CompletenessResult {
            user_id,
            completeness_score: score,
            completeness_tier: tier.to_string(),
            has_avatar,
            has_bio,
            has_valueskin,
            has_price_band,
            has_credential,
            has_testimonial,
            has_barter_pref,
            has_energy_state,
            next_steps: vec![],
        };
        result.next_steps = result.compute_next_steps();
        Ok(result)
    }

    /// Get stored completeness (fast path — no recompute).
    pub async fn get(
        &self,
        user_id: i64,
    ) -> Result<Option<CompletenessResult>, CompletenessError> {
        let row = sqlx::query(
            r#"
            SELECT user_id, has_avatar, has_bio, has_valueskin, has_price_band,
                   has_credential, has_testimonial, has_barter_pref, has_energy_state,
                   completeness_score, completeness_tier
            FROM creator_completeness WHERE user_id = $1
            "#
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            use sqlx::Row;
            let mut result = CompletenessResult {
                user_id,
                completeness_score: row.try_get("completeness_score").unwrap_or(0),
                completeness_tier: row.try_get("completeness_tier").unwrap_or_else(|_| "incomplete".to_string()),
                has_avatar: row.try_get("has_avatar").unwrap_or(false),
                has_bio: row.try_get("has_bio").unwrap_or(false),
                has_valueskin: row.try_get("has_valueskin").unwrap_or(false),
                has_price_band: row.try_get("has_price_band").unwrap_or(false),
                has_credential: row.try_get("has_credential").unwrap_or(false),
                has_testimonial: row.try_get("has_testimonial").unwrap_or(false),
                has_barter_pref: row.try_get("has_barter_pref").unwrap_or(false),
                has_energy_state: row.try_get("has_energy_state").unwrap_or(false),
                next_steps: vec![],
            };
            result.next_steps = result.compute_next_steps();
            Ok(Some(result))
        } else {
            // Not yet computed — compute on demand
            Ok(None)
        }
    }
}
