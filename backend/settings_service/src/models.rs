use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserSettings {
    pub user_id: i64,
    pub willing_to_barter: bool,
    pub energy_state: String,
    pub price_band: String,
    pub auto_escalation: bool,
    pub notifications_enabled: bool,
    pub profile_visibility: String,
    pub updated_at: DateTime<Utc>,
    // Creator preferences
    pub allow_international_deals: bool,
    pub payment_advance_pct: i16,
    pub payment_after_submission_pct: i16,
    pub payment_performance_pct: i16,
    pub payment_plan_negotiable: bool,
    pub creator_requires_advance: bool,
    pub creator_advance_pct_wanted: i16,
    pub creator_advance_negotiable: bool,
    pub posting_rules: sqlx::types::Json<Vec<String>>,
    pub exclusivity_available: bool,
    pub willing_to_sign_nda: bool,
    pub willing_to_sign_usage_rights: bool,
    pub min_deal_size_usd: String,
    pub response_time_hours: String,
    pub product_preference: String,
    pub location_country: String,
    pub willing_to_relocate: bool,
    pub willing_to_travel: bool,
    pub willing_to_appear_at_events: bool,
}

/// Partial update — only specified fields are changed.
/// All fields are optional so clients send only what they want to update.
#[derive(Debug, Deserialize)]
pub struct UpdateSettingsRequest {
    pub willing_to_barter: Option<bool>,
    pub energy_state: Option<String>,
    pub price_band: Option<String>,
    pub auto_escalation: Option<bool>,
    pub notifications_enabled: Option<bool>,
    pub profile_visibility: Option<String>,
    // Creator preferences
    pub allow_international_deals: Option<bool>,
    pub payment_advance_pct: Option<i16>,
    pub payment_after_submission_pct: Option<i16>,
    pub payment_performance_pct: Option<i16>,
    pub payment_plan_negotiable: Option<bool>,
    pub creator_requires_advance: Option<bool>,
    pub creator_advance_pct_wanted: Option<i16>,
    pub creator_advance_negotiable: Option<bool>,
    pub posting_rules: Option<Vec<String>>,
    pub exclusivity_available: Option<bool>,
    pub willing_to_sign_nda: Option<bool>,
    pub willing_to_sign_usage_rights: Option<bool>,
    pub min_deal_size_usd: Option<String>,
    pub response_time_hours: Option<String>,
    pub product_preference: Option<String>,
    pub location_country: Option<String>,
    pub willing_to_relocate: Option<bool>,
    pub willing_to_travel: Option<bool>,
    pub willing_to_appear_at_events: Option<bool>,
}

impl UpdateSettingsRequest {
    /// Validate enum fields and payment split before applying.
    pub fn validate(&self) -> Result<(), &'static str> {
        if let Some(ref e) = self.energy_state {
            if !["available", "limited", "burnout", "pause"].contains(&e.as_str()) {
                return Err("energy_state must be one of: available, limited, burnout, pause");
            }
        }
        if let Some(ref p) = self.price_band {
            if !["experimental", "mid-tier", "premium", "exclusive"].contains(&p.as_str()) {
                return Err("price_band must be one of: experimental, mid-tier, premium, exclusive");
            }
        }
        if let Some(ref v) = self.profile_visibility {
            if !["public", "private", "connections_only"].contains(&v.as_str()) {
                return Err("profile_visibility must be one of: public, private, connections_only");
            }
        }
        // Validate payment split sums to 100 when all three are provided
        if let (Some(adv), Some(sub), Some(perf)) = (
            self.payment_advance_pct,
            self.payment_after_submission_pct,
            self.payment_performance_pct,
        ) {
            if adv + sub + perf != 100 {
                return Err("payment_advance_pct + payment_after_submission_pct + payment_performance_pct must equal 100");
            }
            if adv < 0 || adv > 100 || sub < 0 || sub > 100 || perf < 0 || perf > 100 {
                return Err("payment percentages must be between 0 and 100");
            }
        }
        if let Some(pct) = self.creator_advance_pct_wanted {
            if pct < 0 || pct > 100 {
                return Err("creator_advance_pct_wanted must be between 0 and 100");
            }
        }
        // Validate posting rules length (prevent abuse)
        if let Some(ref rules) = self.posting_rules {
            if rules.len() > 20 {
                return Err("posting_rules cannot exceed 20 items");
            }
            for rule in rules {
                if rule.len() > 500 {
                    return Err("each posting rule must be 500 characters or fewer");
                }
            }
        }
        Ok(())
    }
}
