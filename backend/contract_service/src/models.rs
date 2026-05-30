use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Contract template (admin-managed).
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ContractTemplate {
    pub id: i64,
    pub template_name: String,
    pub template_type: String,
    pub description: String,
    pub template_body: String,
    pub default_revision_cap: i16,
    pub default_kill_fee_pct: i16,
    pub default_advance_pct: i16,
    pub default_exclusivity_days: i32,
    pub usage_rights_description: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Generated contract instance bound to a deal room.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ContractInstance {
    pub id: i64,
    pub deal_room_id: i64,
    pub template_id: i64,
    pub contract_content: String,
    pub contract_hash: String,
    pub pdf_url: Option<String>,
    pub status: String,
    pub exact_amount_cents: i64,
    pub currency: String,
    pub deliverable_list: String,
    pub revision_cap: i16,
    pub kill_fee_pct: i16,
    pub advance_pct: i16,
    pub exclusivity_days: i32,
    pub usage_rights_scope: String,
    pub deadline: Option<DateTime<Utc>>,
    pub brand_signed_at: Option<DateTime<Utc>>,
    pub brand_signed_hash: Option<String>,
    pub creator_signed_at: Option<DateTime<Utc>>,
    pub creator_signed_hash: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Contract revision record.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ContractRevision {
    pub id: i64,
    pub contract_instance_id: i64,
    pub revision_number: i16,
    pub requested_by_user_id: i64,
    pub change_description: String,
    pub is_paid_revision: bool,
    pub additional_cost_cents: Option<i64>,
    pub status: String,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Request to generate a contract for a deal room.
#[derive(Debug, Deserialize)]
pub struct GenerateContractRequest {
    pub deal_room_id: i64,
    pub template_type: String,
    pub exact_amount_cents: i64,
    pub currency: Option<String>,
    pub deliverable_list: String,
    pub revision_cap: Option<i16>,
    pub kill_fee_pct: Option<i16>,
    pub advance_pct: Option<i16>,
    pub exclusivity_days: Option<i32>,
    pub usage_rights_scope: String,
    pub deadline: Option<DateTime<Utc>>,
}

/// Request to sign a contract.
#[derive(Debug, Deserialize)]
pub struct SignContractRequest {
    pub contract_hash: String,
}

/// Request to submit a revision.
#[derive(Debug, Deserialize)]
pub struct RequestRevisionBody {
    pub change_description: String,
    pub is_paid_revision: Option<bool>,
    pub additional_cost_cents: Option<i64>,
}

/// Query for listing templates.
#[derive(Debug, Deserialize)]
pub struct TemplateListQuery {
    pub template_type: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}
