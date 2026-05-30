use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ── DB Models ──

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AccountRow {
    pub id: i64,
    pub legacy_user_id: Option<i64>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub email_verified: bool,
    pub phone_verified: bool,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub preferred_locale: String,
    pub is_active: bool,
    pub is_locked: bool,
    pub locked_until: Option<DateTime<Utc>>,
    pub onboarding_stage: String,
    pub preferences: serde_json::Value,
    pub totp_enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
    pub login_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserModuleRow {
    pub id: i64,
    pub account_id: i64,
    pub module_code: String,
    pub is_active: bool,
    pub activated_at: DateTime<Utc>,
    pub deactivated_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SessionRow {
    pub id: uuid::Uuid,
    pub account_id: i64,
    pub refresh_token: String,
    pub device_info: serde_json::Value,
    pub ip_address: Option<sqlx::types::ipnetwork::IpNetwork>,
    pub is_active: bool,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub last_rotated_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PermissionRow {
    pub id: i64,
    pub module_code: String,
    pub permission_code: String,
    pub description: Option<String>,
}

// ── API Request / Response DTOs ──

#[derive(Debug, Deserialize)]
pub struct ActivateModuleRequest {
    pub module_code: String,
}

#[derive(Debug, Deserialize)]
pub struct DeactivateModuleRequest {
    pub module_code: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePreferencesRequest {
    pub preferences: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccountRequest {
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub preferred_locale: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AccountResponse {
    pub id: i64,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub email_verified: bool,
    pub phone_verified: bool,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub preferred_locale: String,
    pub is_active: bool,
    pub is_locked: bool,
    pub onboarding_stage: String,
    pub preferences: Vec<String>,
    pub modules: Vec<ModuleSummary>,
    pub totp_enabled: bool,
    pub created_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct ModuleSummary {
    pub code: String,
    pub is_active: bool,
    pub activated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub id: uuid::Uuid,
    pub device_info: serde_json::Value,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub is_current: bool,
}

#[derive(Debug, Serialize)]
pub struct PermissionResponse {
    pub permissions: Vec<String>,
}

impl From<AccountRow> for AccountResponse {
    fn from(a: AccountRow) -> Self {
        let preferences: Vec<String> = serde_json::from_value(a.preferences.clone())
            .unwrap_or_default();
        AccountResponse {
            id: a.id,
            email: a.email,
            phone: a.phone,
            email_verified: a.email_verified,
            phone_verified: a.phone_verified,
            display_name: a.display_name,
            avatar_url: a.avatar_url,
            preferred_locale: a.preferred_locale,
            is_active: a.is_active,
            is_locked: a.is_locked,
            onboarding_stage: a.onboarding_stage,
            preferences,
            modules: Vec::new(),
            totp_enabled: a.totp_enabled,
            created_at: a.created_at,
            last_login_at: a.last_login_at,
        }
    }
}

// ── Module → Permission Mapping ──

pub static MODULE_PERMISSIONS: &[(&str, &[&str])] = &[
    ("explorer", &[
        "event.browse", "event.attend", "event.view_details",
        "community.join", "network.connect", "ticket.purchase",
    ]),
    ("host", &[
        "event.create", "event.edit", "event.publish", "event.delete",
        "attendee.manage", "attendee.message", "analytics.event_basic",
        "ticket.configure",
    ]),
    ("valueskin", &[
        "valueskin.create", "valueskin.edit", "marketplace.browse",
        "marketplace.list", "deals.apply", "deals.manage", "brand.connect",
    ]),
    ("brand", &[
        "brand.profile", "creator.discover", "campaign.create",
        "campaign.manage", "deals.negotiate", "analytics.campaign",
    ]),
    ("community", &[
        "community.create", "community.manage", "community.moderate",
        "moderation.flag",
    ]),
];
