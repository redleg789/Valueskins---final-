use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// A matching requirement attached to an opportunity.
/// Brands MUST specify at least one profession they want to target.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MatchingRequirement {
    pub id: i64,
    pub opportunity_id: i64,
    pub required_profession: String,
    pub min_level: i32,
    pub priority: i32,
    pub created_at: DateTime<Utc>,
}

/// A matched creator returned to a brand.
/// Only includes creators whose ValuSkin matches the brand's requirements.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MatchedCreator {
    pub user_id: i64,
    pub username: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub profession: String,
    pub slot: String,
    pub level: i32,
    pub score: i64,
    pub willing_to_barter: bool,
    pub energy_state: String,
    pub price_band: String,
}

/// A matched opportunity returned to a creator.
/// Only includes opportunities from brands targeting the creator's ValuSkin.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MatchedOpportunity {
    pub opportunity_id: i64,
    pub brand_name: String,
    pub title: String,
    pub description: Option<String>,
    pub campaign_type: String,
    pub required_profession: String,
    pub min_level: i32,
    pub compensation_type: String,
    pub reward_amount: Option<i64>,
    pub match_score: f64,
}

/// Audit log entry for match transparency.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MatchAuditEntry {
    pub id: i64,
    pub opportunity_id: Option<i64>,
    pub brand_user_id: i64,
    pub creator_user_id: i64,
    pub matched_profession: String,
    pub match_score: f64,
    pub decision: String,
    pub created_at: DateTime<Utc>,
}

/// Request to set matching requirements when creating/updating an opportunity.
#[derive(Debug, Deserialize)]
pub struct SetMatchingRequirementsRequest {
    pub requirements: Vec<MatchingRequirementInput>,
}

#[derive(Debug, Deserialize)]
pub struct MatchingRequirementInput {
    pub required_profession: String,
    pub min_level: Option<i32>,
    pub priority: Option<i32>,
}

/// Query params for creator discovery (brand-side).
#[derive(Debug, Deserialize)]
pub struct DiscoverCreatorsQuery {
    pub profession: Option<String>,
    pub min_level: Option<i32>,
    pub barter_only: Option<bool>,
    pub energy_filter: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

/// Query params for opportunity discovery (creator-side).
#[derive(Debug, Deserialize)]
pub struct DiscoverOpportunitiesQuery {
    pub valueskin: String,
    pub compensation_filter: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

// === DEAL SUGGESTIONS (AI-ranked proactive matches) ===

/// A proactive deal suggestion pushed to a creator.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DealSuggestion {
    pub id: i64,
    pub brand_user_id: i64,
    pub brand_name: String,
    pub creator_persona_id: i64,
    pub match_score: f64,
    pub match_factors: serde_json::Value,
    pub advance_compatible: bool,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

/// Query params for suggestion listing.
#[derive(Debug, Deserialize)]
pub struct SuggestionQuery {
    pub persona_id: i64,
    pub min_score: Option<f64>,
    pub advance_only: Option<bool>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

/// Query for brand-side ranked creators per opportunity.
#[derive(Debug, Deserialize)]
pub struct RankedCreatorsQuery {
    pub opportunity_id: i64,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

/// Action on a suggestion.
#[derive(Debug, Deserialize)]
pub struct SuggestionAction {
    pub action: String,  // "dismiss" or "convert"
}
