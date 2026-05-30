//! Creator Equity System — token balance, vesting, dividends, pool stats.
//! All endpoints require authenticated user.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse, Responder};
use sqlx::PgPool;

fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    crate::handlers::parse_authenticated_user_id(req)
}

/// GET /equity/me — creator's equity account + pool stats + vesting
pub async fn get_my_equity(req: HttpRequest, pool: web::Data<PgPool>) -> impl Responder {
    let user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };

    // Ensure account exists (auto-provision)
    sqlx::query("INSERT INTO creator_equity_accounts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING")
        .bind(user_id)
        .execute(pool.get_ref())
        .await
        .ok();

    let account: Option<(i64, i64, i64, String, f64, i32, i64, i32, i32, i32, i64, i64, Option<String>)> =
        sqlx::query_as(
            "SELECT total_tokens, vested_tokens, unvested_tokens, tier, multiplier,
                    deals_completed, platform_fees_generated, referrals_converted,
                    content_created, community_contributions,
                    total_dividends_earned, last_dividend_amount,
                    to_char(last_dividend_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
             FROM creator_equity_accounts WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_optional(pool.get_ref())
        .await
        .unwrap_or(None);

    let account = match account {
        Some(a) => a,
        None => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Account not found"})),
    };

    // Vesting events
    let vesting: Vec<(i32, i32, String, String, String)> = sqlx::query_as(
        "SELECT id, tokens,
                to_char(vest_date, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
                source, status
         FROM equity_vesting_events WHERE user_id = $1 ORDER BY vest_date DESC LIMIT 20"
    )
    .bind(user_id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();

    // Pool stats
    let pool_row: Option<(i64, i64, i64, i32, i32, i64, i32, i64, Option<String>, Option<String>)> =
        sqlx::query_as(
            "SELECT total_tokens_issued, total_tokens_vested, pool_value_cents,
                    price_per_token_cents, revenue_share_pct, total_revenue_allocated_cents,
                    total_creators_holding, dividend_pool_cents,
                    to_char(last_dividend_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
                    to_char(next_dividend_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
             FROM equity_pool WHERE id = 1"
        )
        .fetch_optional(pool.get_ref())
        .await
        .unwrap_or(None);

    let ownership_pct = if let Some(ref p) = pool_row {
        if p.1 > 0 { (account.1 as f64 / p.1 as f64) * 100.0 } else { 0.0 }
    } else { 0.0 };

    HttpResponse::Ok().json(serde_json::json!({
        "account": {
            "total_tokens": account.0,
            "vested_tokens": account.1,
            "unvested_tokens": account.2,
            "tier": account.3,
            "multiplier": account.4,
            "contributions": {
                "deals_completed": account.5,
                "platform_fees_generated": account.6,
                "referrals_converted": account.7,
                "content_created": account.8,
                "community_contributions": account.9
            },
            "dividends": {
                "total_earned": account.10,
                "last_payout": account.11,
                "last_payout_date": account.12
            }
        },
        "vesting_events": vesting.iter().map(|v| serde_json::json!({
            "id": v.0, "tokens": v.1, "vest_date": v.2, "source": v.3, "status": v.4
        })).collect::<Vec<_>>(),
        "pool": pool_row.as_ref().map(|p| serde_json::json!({
            "total_tokens_issued": p.0,
            "total_tokens_vested": p.1,
            "pool_value_cents": p.2,
            "price_per_token_cents": p.3,
            "revenue_share_pct": p.4,
            "total_revenue_allocated_cents": p.5,
            "total_creators_holding": p.6,
            "dividend_pool_cents": p.7,
            "last_dividend_at": p.8,
            "next_dividend_at": p.9
        })),
        "ownership_pct": ownership_pct
    }))
}

/// GET /equity/dividends — dividend payout history
pub async fn get_dividend_history(req: HttpRequest, pool: web::Data<PgPool>) -> impl Responder {
    let user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };

    let rows: Vec<(i32, i64, i64, String)> = sqlx::query_as(
        "SELECT id, amount_cents, tokens_held,
                to_char(payout_date, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
         FROM equity_dividend_payouts WHERE user_id = $1 ORDER BY payout_date DESC LIMIT 50"
    )
    .bind(user_id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();

    HttpResponse::Ok().json(serde_json::json!({
        "payouts": rows.iter().map(|r| serde_json::json!({
            "id": r.0, "amount_cents": r.1, "tokens_held": r.2, "payout_date": r.3
        })).collect::<Vec<_>>()
    }))
}
