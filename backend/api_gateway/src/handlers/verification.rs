//! Verification & Trust — linked accounts, trust score, credentials, fraud signals.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse, Responder};
use sqlx::PgPool;

fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    crate::handlers::parse_authenticated_user_id(req)
}

/// GET /verification/me — full verification status: level, linked accounts, trust score, fraud flags
pub async fn get_my_verification(req: HttpRequest, pool: web::Data<PgPool>) -> impl Responder {
    let user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };

    // User basics
    let user: Option<(String, Option<String>, bool)> = sqlx::query_as(
        "SELECT username, display_name, phone_verified FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    if user.is_none() {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "User not found"}));
    }

    // Linked social accounts
    let linked: Vec<(i32, String, Option<String>, Option<String>, Option<String>, String)> = sqlx::query_as(
        "SELECT id, platform, platform_username, profile_url, access_token,
                to_char(connected_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
         FROM social_connections WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();

    // Credentials
    let credentials: Vec<(i32, String, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT id, credential_type, credential_url,
                to_char(verified_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
                to_char(created_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
         FROM creator_credentials WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();

    // Identity proofs
    let identity_proofs: Vec<(i32, String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, platform, proof_hash,
                to_char(verified_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
         FROM identity_proofs WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();

    // Trust score from trust_scores
    let trust: Option<(f64, f64, f64, f64, i32, String)> = sqlx::query_as(
        "SELECT completion_score, response_reliability, consistency_index,
                COALESCE(ghosting_events, 0)::float8,
                COALESCE(revision_abuse_flag::int, 0),
                COALESCE(energy_state, 'available')
         FROM trust_scores WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    // Reputation metrics
    let reputation: Option<(f64, f64, f64, f64, f64, f64)> = sqlx::query_as(
        "SELECT COALESCE(reputation_score, 0), COALESCE(on_time_rate, 0),
                COALESCE(avg_rating, 0), COALESCE(response_score, 0),
                COALESCE(revision_efficiency, 0), COALESCE(repeat_brand_rate, 0)
         FROM creator_reputation_metrics WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    // Fraud signals
    let fraud: Vec<(i32, String, String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, signal_type, severity,
                to_char(detected_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
                to_char(resolved_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
         FROM reputation_fraud_signals WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();

    // Completed deals count + avg rating
    let deal_stats: Option<(i64, f64)> = sqlx::query_as(
        "SELECT COUNT(*), COALESCE(AVG(t.rating), 0)::float8
         FROM completed_deals cd
         LEFT JOIN testimonials t ON t.id = cd.id
         WHERE cd.creator_user_id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    // Compute verification level
    let has_linked = !linked.is_empty();
    let has_identity = !identity_proofs.is_empty() && identity_proofs.iter().any(|p| p.3.is_some());
    let deals_completed = deal_stats.as_ref().map(|d| d.0).unwrap_or(0);
    let avg_rating = deal_stats.as_ref().map(|d| d.1).unwrap_or(0.0);

    let verification_level: i32 = if deals_completed >= 20 && avg_rating >= 4.8 {
        5
    } else if deals_completed >= 3 && avg_rating >= 4.5 {
        4
    } else if has_identity {
        3
    } else if has_linked {
        2
    } else {
        1
    };

    // Trust score breakdown (0-25 each)
    let verification_score = verification_level * 5;
    let completion_score = if deals_completed >= 20 { 25 } else if deals_completed >= 10 { 20 } else if deals_completed >= 5 { 15 } else if deals_completed >= 1 { 10 } else { 5 };
    let rating_score = ((avg_rating / 5.0) * 25.0).round() as i32;
    let unresolved_fraud = fraud.iter().filter(|f| f.4.is_none()).count() as i32;
    let fraud_penalty = (unresolved_fraud * 10).min(25);
    let authenticity_score = (25 - fraud_penalty).max(0);
    let total_trust_score = verification_score + completion_score + rating_score + authenticity_score;

    HttpResponse::Ok().json(serde_json::json!({
        "verification_level": verification_level,
        "email_verified": true,
        "linked_accounts": linked.iter().map(|l| serde_json::json!({
            "id": l.0, "platform": l.1, "username": l.2,
            "profile_url": l.3, "linked_at": l.5
        })).collect::<Vec<_>>(),
        "credentials": credentials.iter().map(|c| serde_json::json!({
            "id": c.0, "type": c.1, "url": c.2, "verified_at": c.3, "created_at": c.4
        })).collect::<Vec<_>>(),
        "identity_proofs": identity_proofs.iter().map(|p| serde_json::json!({
            "id": p.0, "platform": p.1, "verified_at": p.3
        })).collect::<Vec<_>>(),
        "id_verified": has_identity,
        "deals_completed": deals_completed,
        "avg_rating": avg_rating,
        "trust_score": total_trust_score,
        "trust_breakdown": {
            "verification": verification_score,
            "completion": completion_score,
            "rating": rating_score,
            "authenticity": authenticity_score
        },
        "trust_metrics": trust.as_ref().map(|t| serde_json::json!({
            "completion_score": t.0, "response_reliability": t.1,
            "consistency_index": t.2, "ghosting_events": t.3,
            "revision_abuse": t.4 > 0, "energy_state": t.5
        })),
        "reputation": reputation.as_ref().map(|r| serde_json::json!({
            "reputation_score": r.0, "on_time_rate": r.1, "avg_rating": r.2,
            "response_score": r.3, "revision_efficiency": r.4, "repeat_brand_rate": r.5
        })),
        "fraud_signals": fraud.iter().map(|f| serde_json::json!({
            "id": f.0, "type": f.1, "severity": f.2,
            "detected_at": f.3, "resolved_at": f.4
        })).collect::<Vec<_>>()
    }))
}
