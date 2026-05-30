//! Creator Collectives — guilds, minimum rates, market data.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse, Responder};
use sqlx::PgPool;

fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    crate::handlers::parse_authenticated_user_id(req)
}

/// GET /collectives — list collectives the user belongs to or all public
pub async fn list_collectives(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> impl Responder {
    let user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };

    let rows: Vec<(i32, String, String, String, i32, i64, f64, i32, i64, i32, i32, i64, Option<String>)> =
        sqlx::query_as(
            "SELECT c.id, c.name, c.description, c.category,
                    c.total_members, c.total_combined_followers, c.avg_member_level::float8,
                    c.total_deals_negotiated, c.avg_deal_value_cents,
                    c.avg_rate_increase_pct, c.brands_partnered,
                    c.treasury_balance_cents,
                    cm.role
             FROM creator_collectives c
             LEFT JOIN collective_members cm ON cm.collective_id = c.id AND cm.user_id = $1
             ORDER BY c.total_members DESC
             LIMIT 50"
        )
        .bind(user_id)
        .fetch_all(pool.get_ref())
        .await
        .unwrap_or_default();

    HttpResponse::Ok().json(serde_json::json!({
        "collectives": rows.iter().map(|r| serde_json::json!({
            "id": r.0, "name": r.1, "description": r.2, "category": r.3,
            "total_members": r.4, "total_combined_followers": r.5,
            "avg_member_level": r.6,
            "stats": {
                "total_deals_negotiated": r.7,
                "avg_deal_value_cents": r.8,
                "avg_rate_increase_pct": r.9,
                "brands_partnered": r.10
            },
            "treasury_balance_cents": r.11,
            "my_role": r.12
        })).collect::<Vec<_>>()
    }))
}

/// GET /collectives/{id} — single collective with members, rates, blacklist
pub async fn get_collective(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i32>,
) -> impl Responder {
    let _user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };
    let collective_id = path.into_inner();

    let coll: Option<(i32, String, String, String, i32, i32, i64, f64, i32, i64, i32, i32, i64, i32)> =
        sqlx::query_as(
            "SELECT id, name, description, category, president_user_id,
                    total_members, total_combined_followers, avg_member_level::float8,
                    total_deals_negotiated, avg_deal_value_cents,
                    avg_rate_increase_pct, brands_partnered,
                    treasury_balance_cents, voting_threshold
             FROM creator_collectives WHERE id = $1"
        )
        .bind(collective_id)
        .fetch_optional(pool.get_ref())
        .await
        .unwrap_or(None);

    let coll = match coll {
        Some(c) => c,
        None => return HttpResponse::NotFound().json(serde_json::json!({"error": "Collective not found"})),
    };

    // Members (top 20)
    let members: Vec<(i32, String, Option<String>, String, f64, i64, i32, String)> = sqlx::query_as(
        "SELECT cm.user_id, u.username, u.display_name, cm.role,
                cm.voting_power::float8, cm.contributions_cents, cm.deals_thru_collective,
                to_char(cm.joined_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
         FROM collective_members cm JOIN users u ON u.id = cm.user_id
         WHERE cm.collective_id = $1 ORDER BY cm.voting_power DESC LIMIT 20"
    )
    .bind(collective_id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();

    // Minimum rates
    let rates: Vec<(i32, String, String, i64, String, String)> = sqlx::query_as(
        "SELECT id, content_type, platform, min_rate_cents, per_metric,
                to_char(effective_date, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
         FROM collective_minimum_rates WHERE collective_id = $1 ORDER BY content_type"
    )
    .bind(collective_id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();

    // Blacklisted brands
    let blacklisted: Vec<(i32, String, String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, brand_name, reason,
                to_char(blacklisted_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
                to_char(blacklisted_until, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
         FROM collective_blacklisted_brands WHERE collective_id = $1"
    )
    .bind(collective_id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();

    HttpResponse::Ok().json(serde_json::json!({
        "id": coll.0, "name": coll.1, "description": coll.2, "category": coll.3,
        "president_user_id": coll.4,
        "total_members": coll.5, "total_combined_followers": coll.6,
        "avg_member_level": coll.7, "voting_threshold": coll.13,
        "stats": {
            "total_deals_negotiated": coll.8,
            "avg_deal_value_cents": coll.9,
            "avg_rate_increase_pct": coll.10,
            "brands_partnered": coll.11
        },
        "treasury_balance_cents": coll.12,
        "members": members.iter().map(|m| serde_json::json!({
            "user_id": m.0, "username": m.1, "display_name": m.2, "role": m.3,
            "voting_power": m.4, "contributions_cents": m.5,
            "deals_thru_collective": m.6, "joined_at": m.7
        })).collect::<Vec<_>>(),
        "minimum_rates": rates.iter().map(|r| serde_json::json!({
            "id": r.0, "content_type": r.1, "platform": r.2,
            "min_rate_cents": r.3, "per_metric": r.4, "effective_date": r.5
        })).collect::<Vec<_>>(),
        "blacklisted_brands": blacklisted.iter().map(|b| serde_json::json!({
            "id": b.0, "brand_name": b.1, "reason": b.2,
            "blacklisted_at": b.3, "blacklisted_until": b.4
        })).collect::<Vec<_>>()
    }))
}

/// GET /market-rates — aggregated market rate data
pub async fn get_market_rates(pool: web::Data<PgPool>) -> impl Responder {
    let rows: Vec<(String, String, String, i32, i64, i64, i64, String, f64, i32, String)> =
        sqlx::query_as(
            "SELECT category, platform, content_type, level,
                    min_rate_cents, median_rate_cents, max_rate_cents,
                    trend, change_last_month_pct::float8, data_points,
                    to_char(updated_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
             FROM market_rate_data ORDER BY category, platform, content_type, level
             LIMIT 200"
        )
        .fetch_all(pool.get_ref())
        .await
        .unwrap_or_default();

    HttpResponse::Ok().json(serde_json::json!({
        "rates": rows.iter().map(|r| serde_json::json!({
            "category": r.0, "platform": r.1, "content_type": r.2, "level": r.3,
            "min_rate_cents": r.4, "median_rate_cents": r.5, "max_rate_cents": r.6,
            "trend": r.7, "change_last_month_pct": r.8, "data_points": r.9,
            "updated_at": r.10
        })).collect::<Vec<_>>()
    }))
}
