//! Marketplace Models

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use sqlx::types::JsonValue;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Opportunity {
    pub id: i64,
    pub brand_id: Option<i64>,
    pub brand_user_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub category: String,
    pub required_profession_id: i64,
    pub required_level: i32,
    pub reward_amount: String,
    pub reward_currency: Option<String>,
    pub deadline: DateTime<Utc>,
    pub status: String,
    pub selected_persona_id: Option<i64>,
    pub compensation_type: String,
    pub barter_description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Campaign gating fields (nullable — added by migration)
    pub gating_type: Option<String>,                    // 'any' | 'specific' | 'professional'
    pub required_professions: Option<Vec<i64>>,         // profession IDs for gating
    pub required_professions_logic: Option<String>,     // 'AND' | 'OR'
    pub required_min_level: Option<i32>,
    pub visibility_for_non_matching: Option<String>,    // 'hidden' | 'visible_with_block' | 'visible_with_prompt'
    pub access_message_for_blocked: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Application {
    pub id: i64,
    pub opportunity_id: i64,
    pub persona_id: i64,
    pub applicant_user_id: i64,
    pub pitch: Option<String>,
    pub proposed_rate: Option<f64>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CompletedDeal {
    pub id: i64,
    pub opportunity_id: i64,
    pub brand_id: Option<i64>,
    pub brand_user_id: i64,
    pub creator_persona_id: i64,
    pub creator_user_id: i64,
    pub total_amount: f64,
    pub creator_payout: f64,
    pub platform_fee: f64,
    pub platform_fee_percentage: f64,
    pub compensation_type: String,
    pub completed_at: DateTime<Utc>,
}

// API Response types

#[derive(Debug, Serialize)]
pub struct OpportunityResponse {
    pub id: i64,
    pub brand_name: Option<String>,
    pub brand_logo: Option<String>,
    pub brand_verified: bool,
    pub title: String,
    pub description: String,
    pub category: String,
    pub required_profession_id: i64,
    pub required_profession_name: String,
    pub required_level: i32,
    pub reward_amount: String,
    pub reward_currency: String,
    pub compensation_type: String,
    pub barter_description: Option<String>,
    pub deadline: DateTime<Utc>,
    pub status: String,
    pub application_count: i32,
    pub created_at: DateTime<Utc>,
    pub can_apply: bool,
    /// Whether the creator has opted into barter/exposure deals
    pub creator_open_to_barter: bool,
    // Gating fields returned to clients
    pub gating_type: Option<String>,
    pub visibility_mode: Option<String>,       // 'hidden' | 'visible_with_block' | 'visible_with_prompt'
    pub access_message: Option<String>,        // why the creator is blocked
    pub gating_decision: Option<String>,       // 'visible' | 'blocked_no_profession' | 'blocked_low_level' | 'blocked_hidden'
}

#[derive(Debug, Serialize)]
pub struct ApplicationResponse {
    pub id: i64,
    pub opportunity_id: i64,
    pub opportunity_title: String,
    pub persona_id: i64,
    pub persona_name: String,
    pub username: String,  // same as persona_name, for frontend compatibility
    pub persona_level: i32,
    pub pitch: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

// Request types

#[derive(Debug, Deserialize)]
pub struct CreateOpportunityRequest {
    pub title: String,
    pub description: String,
    pub category: String,
    pub required_profession_id: i64,
    pub required_level: i32,
    pub reward_amount: String,
    pub reward_currency: Option<String>,
    pub duration_days: i32,
    /// "paid" | "barter" | "exposure" | "hybrid" — defaults to "paid"
    pub compensation_type: Option<String>,
    /// What the brand offers in return (required for barter/exposure/hybrid)
    pub barter_description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApplyRequest {
    pub opportunity_id: i64,
    pub persona_id: i64,
    pub pitch: String,
}

#[derive(Debug, Deserialize)]
pub struct AcceptApplicationRequest {
    pub opportunity_id: i64,
    pub persona_id: i64,
}

#[derive(Debug, Deserialize)]
pub struct OpportunityFilters {
    pub profession_id: Option<i64>,
    pub min_level: Option<i32>,
    pub max_level: Option<i32>,
    pub category: Option<String>,
    pub status: Option<String>,
    /// Filter by compensation type: "paid", "barter", "exposure", "hybrid"
    pub compensation_type: Option<String>,
    /// If true, only show opportunities from brands willing to barter
    pub barter_only: Option<bool>,
    /// If true, exclude barter/exposure-only deals (show only paid/hybrid)
    pub exclude_barter: Option<bool>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
    /// If provided, only show campaigns matching this gating_type
    pub gating_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MarketplaceStats {
    pub total_opportunities: i64,
    pub active_opportunities: i64,
    pub completed_deals: i64,
    pub total_volume: String,
    pub total_platform_revenue: String,
    pub avg_deal_size: String,
}

// ── Deal Room ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DealRoom {
    pub id: i64,
    pub opportunity_id: Option<i64>,
    pub brand_user_id: i64,
    pub creator_persona_id: i64,
    pub intent: String,
    pub brief_title: Option<String>,
    pub brief_description: Option<String>,
    pub brief_deliverables: Option<String>,
    pub brief_deadline: Option<DateTime<Utc>>,
    pub brief_campaign_type: Option<String>,
    pub status: String,
    pub quiet_mode: bool,
    pub compensation_type: String,
    pub creator_tz_offset: Option<i32>,
    pub creator_window_start: Option<i32>,
    pub creator_window_end: Option<i32>,
    pub last_action_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct OpenDealRoomRequest {
    pub opportunity_id: Option<i64>,
    pub creator_persona_id: i64,
    /// brand must declare: "explore" | "campaign" | "long-term"
    pub intent: String,
    /// Mandatory brief before first contact
    pub brief_title: String,
    pub brief_description: String,
    pub brief_deliverables: String,
    pub brief_deadline: Option<DateTime<Utc>>,
    pub brief_campaign_type: String,
    /// "paid" | "barter" | "exposure" | "hybrid" — defaults to "paid"
    pub compensation_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DealRoomSummary {
    pub id: i64,
    pub opportunity_id: Option<i64>,
    pub opportunity_title: Option<String>,
    pub creator_persona_id: i64,
    pub creator_name: String,
    pub brand_persona_id: i64,
    pub brand_name: String,
    pub intent: String,
    pub status: String,
    pub brief_title: Option<String>,
    pub brief_campaign_type: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub last_action_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub offer_count: i64,
    pub latest_amount_cents: Option<i64>,
    pub last_message: Option<String>,
    pub last_message_at: Option<DateTime<Utc>>,
    pub unread_count: i64,
    /// Suggested fair range from negotiation memory (None if no history)
    pub suggested_floor_cents: Option<i64>,
    pub suggested_ceiling_cents: Option<i64>,
    /// Creator's public band label ("mid-tier", "premium", etc.)
    pub creator_price_band: Option<String>,
    pub has_active_soft_hold: bool,
}

// ── Offer Rounds ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OfferRound {
    pub id: i64,
    pub deal_room_id: i64,
    pub made_by: String,
    pub amount_cents: i64,
    pub currency: String,
    pub note: Option<String>,
    pub response_due_at: DateTime<Utc>,
    pub responded_at: Option<DateTime<Utc>>,
    pub response: Option<String>,
    pub silent_decline: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct MakeOfferRequest {
    pub deal_room_id: i64,
    pub amount_cents: i64,
    pub currency: Option<String>,
    pub note: Option<String>,
    /// Hours the other party has to respond (default 24)
    pub response_hours: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct RespondOfferRequest {
    pub offer_round_id: i64,
    pub response: String,          // "accepted" | "rejected" | "countered"
    pub silent_decline: Option<bool>,
    /// If "countered", provide counter amount
    pub counter_amount_cents: Option<i64>,
    pub counter_note: Option<String>,
}

// ── Soft Hold ─────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateSoftHoldRequest {
    pub deal_room_id: i64,
    /// 24, 48, or 72 hours
    pub hold_duration_hours: i32,
}

// ── Auto-escalation ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SetAutoEscalationRequest {
    pub profession_id: Option<i64>,
    pub floor_cents: i64,
    pub currency: Option<String>,
    pub lowball_threshold: Option<i32>,
}

// ── Price band ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SetPriceBandRequest {
    pub profession_id: i64,
    /// "experimental" | "mid-tier" | "premium" | "exclusive"
    pub band_label: String,
    pub exact_floor_cents: i64,
    pub exact_ceiling_cents: i64,
    pub currency: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PriceBandPublic {
    pub persona_id: i64,
    pub profession_id: i64,
    pub band_label: String,
    // exact numbers deliberately omitted from this struct
}

// ── Trust scores ──────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TrustScore {
    pub persona_id: i64,
    pub completion_score: i16,
    pub response_reliability: i16,
    pub consistency_index: i16,
    pub revision_abuse_flag: bool,
    pub fake_urgency_flag: bool,
    pub ghosting_events: i32,
    pub energy_state: String,
    pub seriousness_score: i16,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SetEnergyStateRequest {
    /// "available" | "limited" | "burnout" | "pause"
    pub energy_state: String,
}

// ── Deliverables ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UploadDeliverableRequest {
    pub deal_room_id: i64,
    pub deliverable_type: String,
    pub content_url: String,
    pub campaign_type: Option<String>,
    /// Fraction of deal value this deliverable represents (0.0 – 1.0)
    pub payout_weight: Option<f64>,
}

// ── Testimonials ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SubmitTestimonialRequest {
    pub deal_room_id: i64,
    pub for_persona_id: i64,
    pub campaign_type: String,
    pub rating: i16,
    pub body: Option<String>,
    pub is_public: Option<bool>,
}

// ── Escrow ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateEscrowStagesRequest {
    pub deal_room_id: i64,
    /// Each item: { stage_name, amount_cents, denominated_in, brand_asset_due_at }
    pub stages: Vec<EscrowStageInput>,
}

#[derive(Debug, Deserialize)]
pub struct EscrowStageInput {
    pub stage_name: String,   // "advance" | "milestone" | "completion"
    pub amount_cents: i64,
    pub denominated_in: Option<String>,
    pub brand_asset_due_at: Option<DateTime<Utc>>,
}

// ── ValueSkin versioning ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SetSkinStateRequest {
    pub profession_id: i64,
    /// "active" | "dormant" | "pivot" | "retired"
    pub state: String,
    pub outcome_tags: Option<Vec<String>>,
    pub managed_by: Option<String>,
    pub agency_name: Option<String>,
}

// ── Calendar ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SetCalendarSlotRequest {
    pub slot_date: chrono::NaiveDate,
    /// "available" | "tentative" | "booked" | "blocked"
    pub slot_label: String,
}

// ── Repeat collab ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RepeatCollabRequest {
    pub original_room_id: i64,
}

// ── Expectation checklist ─────────────────────────────────────────────

/// Returned from GET /deal-rooms/{id}/checklist — both sides must tick off
/// before the deal can be finalised
#[derive(Debug, Serialize)]
pub struct ExpectationChecklist {
    pub deal_room_id: i64,
    pub items: Vec<ChecklistItem>,
    pub brand_completed: bool,
    pub creator_completed: bool,
}

#[derive(Debug, Serialize)]
pub struct ChecklistItem {
    pub key: &'static str,
    pub label: &'static str,
    pub required: bool,
}

// ── Barter Preference ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SetBarterPreferenceRequest {
    pub willing_to_barter: bool,
}

#[derive(Debug, Serialize)]
pub struct BarterPreferenceResponse {
    pub user_id: i64,
    pub willing_to_barter: bool,
}

/// Allowed compensation types — validated at the service boundary
pub const VALID_COMPENSATION_TYPES: [&str; 4] = ["paid", "barter", "exposure", "hybrid"];

// ── Escrow Disputes (user-facing) ──────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateDisputeRequest {
    pub escrow_stage_id: i64,
    pub reason: String,
    #[serde(default)]
    pub evidence_urls: Vec<String>,
}

// ── Payment Preferences ────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SavePaymentPreferencesRequest {
    /// Advance percentage (0-100).
    pub advance_pct: i16,
    /// After submission percentage (0-100). Optional, defaults to 0.
    pub after_submission_pct: Option<i16>,
    /// Performance percentage (0-100). Optional, auto-calculated as remainder.
    pub performance_pct: Option<i16>,
    /// Whether performance clause is enabled.
    pub performance_clause_enabled: bool,
}

#[derive(Debug, Serialize)]
pub struct PaymentPreferencesResponse {
    pub deal_room_id: i64,
    pub advance_pct: i16,
    pub performance_clause_enabled: bool,
    pub performance_pct: i16,
}

// ── Deal Finalization ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct FinalizeDealRequest {
    /// Optional message to include when finalizing
    pub message: Option<String>,
}
