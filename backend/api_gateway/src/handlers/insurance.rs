//! Creator Insurance / Protection Fund — policy, claims, pool stats.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse, Responder};
use serde::Deserialize;
use sqlx::PgPool;

fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    crate::handlers::parse_authenticated_user_id(req)
}

/// GET /insurance/me — creator's insurance policy + claims
pub async fn get_my_insurance(req: HttpRequest, pool: web::Data<PgPool>) -> impl Responder {
    let user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };

    // Auto-provision Basic policy
    sqlx::query(
        "INSERT INTO creator_insurance_policies (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING"
    )
    .bind(user_id)
    .execute(pool.get_ref())
    .await
    .ok();

    let policy: Option<(i32, String, String, i64, i64, i64, i64, i64, i64, Option<String>, i32, i32, i32, i64, String, String)> =
        sqlx::query_as(
            "SELECT id, status, tier,
                    non_payment_max_cents, income_protection_monthly_cents,
                    legal_defense_max_cents, emergency_fund_max_cents,
                    total_contributed_cents, last_contribution_cents,
                    to_char(last_contribution_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
                    months_active, claims_last_12m, risk_score, total_claims_paid_cents,
                    to_char(start_date, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
                    to_char(renewal_date, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
             FROM creator_insurance_policies WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_optional(pool.get_ref())
        .await
        .unwrap_or(None);

    let policy = match policy {
        Some(p) => p,
        None => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Policy not found"})),
    };

    let policy_id = policy.0;

    // Claims
    let claims: Vec<(i32, String, i64, String, String, String, Option<String>, Option<String>, Option<i64>, Option<String>, i32, i32)> =
        sqlx::query_as(
            "SELECT id, claim_type, amount_cents, description, status,
                    to_char(submitted_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
                    to_char(reviewed_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
                    review_notes, amount_approved_cents,
                    to_char(payment_date, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
                    community_votes_for, community_votes_against
             FROM insurance_claims WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 50"
        )
        .bind(user_id)
        .fetch_all(pool.get_ref())
        .await
        .unwrap_or_default();

    HttpResponse::Ok().json(serde_json::json!({
        "policy": {
            "id": policy_id,
            "status": policy.1,
            "tier": policy.2,
            "coverage": {
                "non_payment_max_cents": policy.3,
                "income_protection_monthly_cents": policy.4,
                "legal_defense_max_cents": policy.5,
                "emergency_fund_max_cents": policy.6
            },
            "contributions": {
                "total_contributed_cents": policy.7,
                "last_contribution_cents": policy.8,
                "last_contribution_at": policy.9
            },
            "eligibility": {
                "months_active": policy.10,
                "claims_last_12m": policy.11,
                "risk_score": policy.12
            },
            "total_claims_paid_cents": policy.13,
            "start_date": policy.14,
            "renewal_date": policy.15
        },
        "claims": claims.iter().map(|c| serde_json::json!({
            "id": c.0, "type": c.1, "amount_cents": c.2, "description": c.3,
            "status": c.4, "submitted_at": c.5, "reviewed_at": c.6,
            "review_notes": c.7, "amount_approved_cents": c.8, "payment_date": c.9,
            "community_votes_for": c.10, "community_votes_against": c.11
        })).collect::<Vec<_>>()
    }))
}

/// GET /insurance/pool — protection pool stats (public)
pub async fn get_protection_pool(pool: web::Data<PgPool>) -> impl Responder {
    let row: Option<(i64, i64, i64, i32, i64, i64, i32, i32, i32, i32, i32, Option<String>)> =
        sqlx::query_as(
            "SELECT total_balance_cents, available_cents, reserved_cents,
                    contribution_rate, total_contributions_cents, total_claims_paid_cents,
                    health_score, runway_months, total_policies, active_claims,
                    claim_approval_rate,
                    to_char(last_audit_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
             FROM protection_pool WHERE id = 1"
        )
        .fetch_optional(pool.get_ref())
        .await
        .unwrap_or(None);

    match row {
        Some(r) => HttpResponse::Ok().json(serde_json::json!({
            "total_balance_cents": r.0,
            "available_cents": r.1,
            "reserved_cents": r.2,
            "contribution_rate": r.3,
            "total_contributions_cents": r.4,
            "total_claims_paid_cents": r.5,
            "health_score": r.6,
            "runway_months": r.7,
            "total_policies": r.8,
            "active_claims": r.9,
            "claim_approval_rate": r.10,
            "last_audit_at": r.11
        })),
        None => HttpResponse::Ok().json(serde_json::json!({
            "total_balance_cents": 0, "available_cents": 0, "reserved_cents": 0,
            "contribution_rate": 2, "health_score": 100
        })),
    }
}

#[derive(Deserialize)]
pub struct FileClaimBody {
    pub claim_type: String,
    pub amount_cents: i64,
    pub description: String,
}

/// POST /insurance/claims — file a new claim
pub async fn file_claim(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<FileClaimBody>,
) -> impl Responder {
    let user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };

    let valid_types = ["non_payment", "partial_payment", "income_drop", "legal_defense", "platform_ban", "reputation_damage", "emergency"];
    if !valid_types.contains(&body.claim_type.as_str()) {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid claim type"}));
    }
    if body.amount_cents <= 0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Amount must be positive"}));
    }
    if body.description.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Description required"}));
    }

    // Get policy
    let policy_id: Option<(i32,)> = sqlx::query_as(
        "SELECT id FROM creator_insurance_policies WHERE user_id = $1 AND status = 'active'"
    )
    .bind(user_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    let policy_id = match policy_id {
        Some(p) => p.0,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "No active policy"})),
    };

    let idempotency_key = format!("claim-{}-{}-{}", user_id, body.claim_type, chrono::Utc::now().timestamp());

    match sqlx::query_as::<_, (i32,)>(
        "INSERT INTO insurance_claims (user_id, policy_id, claim_type, amount_cents, description, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id"
    )
    .bind(user_id)
    .bind(policy_id)
    .bind(&body.claim_type)
    .bind(body.amount_cents)
    .bind(body.description.trim())
    .bind(&idempotency_key)
    .fetch_one(pool.get_ref())
    .await {
        Ok(r) => HttpResponse::Created().json(serde_json::json!({"claim_id": r.0, "status": "submitted"})),
        Err(e) => {
            tracing::error!(error = %e, "Failed to file claim");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to file claim"}))
        }
    }
}
