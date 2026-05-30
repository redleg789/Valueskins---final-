use sqlx::PgPool;
use crate::models::*;

pub struct SettingsService {
    pool: PgPool,
}

#[derive(Debug)]
pub enum SettingsError {
    Validation(&'static str),
    Database(sqlx::Error),
}

impl From<sqlx::Error> for SettingsError {
    fn from(e: sqlx::Error) -> Self {
        SettingsError::Database(e)
    }
}

const SELECT_ALL_COLS: &str = r#"
    user_id, willing_to_barter, energy_state, price_band,
    auto_escalation, notifications_enabled, profile_visibility, updated_at,
    allow_international_deals,
    payment_advance_pct, payment_after_submission_pct, payment_performance_pct,
    payment_plan_negotiable,
    creator_requires_advance, creator_advance_pct_wanted, creator_advance_negotiable,
    posting_rules, exclusivity_available, willing_to_sign_nda, willing_to_sign_usage_rights,
    min_deal_size_usd, response_time_hours, product_preference, location_country,
    willing_to_relocate, willing_to_travel, willing_to_appear_at_events
"#;

impl SettingsService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Get settings for a user. Creates default row if none exists (UPSERT pattern).
    pub async fn get_settings(&self, user_id: i64) -> Result<UserSettings, SettingsError> {
        // Ensure row exists
        sqlx::query(
            "INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING"
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        let query = format!(
            "SELECT {} FROM user_settings WHERE user_id = $1",
            SELECT_ALL_COLS
        );

        let s = sqlx::query_as::<_, UserSettings>(&query)
            .bind(user_id)
            .fetch_one(&self.pool)
            .await?;

        Ok(s)
    }

    /// Update settings — partial update, only specified fields change.
    pub async fn update_settings(
        &self,
        user_id: i64,
        req: &UpdateSettingsRequest,
    ) -> Result<UserSettings, SettingsError> {
        req.validate().map_err(SettingsError::Validation)?;

        // Ensure row exists first
        sqlx::query(
            "INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING"
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        // Convert posting_rules to JSON for binding
        let posting_rules_json = req.posting_rules.as_ref().map(|r| serde_json::json!(r));

        let query = format!(
            r#"UPDATE user_settings SET
                willing_to_barter = COALESCE($2, willing_to_barter),
                energy_state = COALESCE($3, energy_state),
                price_band = COALESCE($4, price_band),
                auto_escalation = COALESCE($5, auto_escalation),
                notifications_enabled = COALESCE($6, notifications_enabled),
                profile_visibility = COALESCE($7, profile_visibility),
                allow_international_deals = COALESCE($8, allow_international_deals),
                payment_advance_pct = COALESCE($9, payment_advance_pct),
                payment_after_submission_pct = COALESCE($10, payment_after_submission_pct),
                payment_performance_pct = COALESCE($11, payment_performance_pct),
                payment_plan_negotiable = COALESCE($12, payment_plan_negotiable),
                creator_requires_advance = COALESCE($13, creator_requires_advance),
                creator_advance_pct_wanted = COALESCE($14, creator_advance_pct_wanted),
                creator_advance_negotiable = COALESCE($15, creator_advance_negotiable),
                posting_rules = COALESCE($16, posting_rules),
                exclusivity_available = COALESCE($17, exclusivity_available),
                willing_to_sign_nda = COALESCE($18, willing_to_sign_nda),
                willing_to_sign_usage_rights = COALESCE($19, willing_to_sign_usage_rights),
                min_deal_size_usd = COALESCE($20, min_deal_size_usd),
                response_time_hours = COALESCE($21, response_time_hours),
                product_preference = COALESCE($22, product_preference),
                location_country = COALESCE($23, location_country),
                willing_to_relocate = COALESCE($24, willing_to_relocate),
                willing_to_travel = COALESCE($25, willing_to_travel),
                willing_to_appear_at_events = COALESCE($26, willing_to_appear_at_events),
                updated_at = NOW()
            WHERE user_id = $1
            RETURNING {}"#,
            SELECT_ALL_COLS
        );

        let settings = sqlx::query_as::<_, UserSettings>(&query)
            .bind(user_id)
            .bind(req.willing_to_barter)
            .bind(req.energy_state.as_deref())
            .bind(req.price_band.as_deref())
            .bind(req.auto_escalation)
            .bind(req.notifications_enabled)
            .bind(req.profile_visibility.as_deref())
            .bind(req.allow_international_deals)
            .bind(req.payment_advance_pct)
            .bind(req.payment_after_submission_pct)
            .bind(req.payment_performance_pct)
            .bind(req.payment_plan_negotiable)
            .bind(req.creator_requires_advance)
            .bind(req.creator_advance_pct_wanted)
            .bind(req.creator_advance_negotiable)
            .bind(posting_rules_json)
            .bind(req.exclusivity_available)
            .bind(req.willing_to_sign_nda)
            .bind(req.willing_to_sign_usage_rights)
            .bind(req.min_deal_size_usd.as_deref())
            .bind(req.response_time_hours.as_deref())
            .bind(req.product_preference.as_deref())
            .bind(req.location_country.as_deref())
            .bind(req.willing_to_relocate)
            .bind(req.willing_to_travel)
            .bind(req.willing_to_appear_at_events)
            .fetch_one(&self.pool)
            .await?;

        Ok(settings)
    }
}
