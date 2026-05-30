//! Media Kit — auto-generated creator portfolios.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse, Responder};
use serde::Deserialize;
use sqlx::{PgPool, Row};

fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    crate::handlers::parse_authenticated_user_id(req)
}

/// GET /mediakit/me — creator's media kit
pub async fn get_my_mediakit(req: HttpRequest, pool: web::Data<PgPool>) -> impl Responder {
    let user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };

    // Auto-provision kit from user data
    sqlx::query(
        "INSERT INTO creator_media_kits (user_id, tagline, bio, niche)
         SELECT $1, COALESCE(u.display_name, u.username) || ' | Creator', '', ''
         FROM users u WHERE u.id = $1
         ON CONFLICT (user_id) DO NOTHING"
    )
    .bind(user_id)
    .execute(pool.get_ref())
    .await
    .ok();

    let kit_row = match sqlx::query(
            "SELECT mk.id, mk.tagline, mk.bio, mk.location, mk.niche,
                    array_to_string(mk.specialties, ',') AS specialties_str,
                    mk.total_followers, mk.avg_engagement_rate::float8 AS avg_engagement_rate, mk.monthly_reach,
                    mk.is_public, mk.custom_slug, mk.views, mk.downloads, mk.show_rates,
                    mk.brand_color_primary, mk.brand_color_secondary, mk.brand_color_accent,
                    array_to_string(mk.languages, ',') AS languages_str
             FROM creator_media_kits mk WHERE mk.user_id = $1"
        )
        .bind(user_id)
        .fetch_optional(pool.get_ref())
        .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Kit not found"})),
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Kit not found"})),
    };

    let kit_id: i32 = kit_row.get(0);

    // Rates
    let rates: Vec<(i32, String, String, i64, String)> = sqlx::query_as(
        "SELECT id, rate_type, platform, price_cents, description
         FROM mediakit_rates WHERE mediakit_id = $1 ORDER BY id"
    )
    .bind(kit_id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();

    // Featured content
    let content: Vec<(i32, String, String, Option<String>, String, i32, i32, i32)> = sqlx::query_as(
        "SELECT id, platform, content_type, thumbnail_url, url, views, likes, comments
         FROM mediakit_featured_content WHERE mediakit_id = $1 ORDER BY sort_order"
    )
    .bind(kit_id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();

    // Collaborations
    let collabs: Vec<(i32, String, String, Option<String>, String)> = sqlx::query_as(
        "SELECT id, brand_name, campaign_type, results,
                to_char(collab_date, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
         FROM mediakit_collaborations WHERE mediakit_id = $1 ORDER BY collab_date DESC"
    )
    .bind(kit_id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();

    // Creator username for public URL
    let username: Option<(String,)> = sqlx::query_as(
        "SELECT username FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    let specialties_str: String = kit_row.get(5);
    let languages_str: String = kit_row.get(17);
    let tagline: String = kit_row.get(1);
    let bio: String = kit_row.get(2);
    let location: Option<String> = kit_row.get(3);
    let niche: String = kit_row.get(4);
    let total_followers: i64 = kit_row.get(6);
    let avg_engagement_rate: f64 = kit_row.get(7);
    let monthly_reach: i64 = kit_row.get(8);
    let is_public: bool = kit_row.get(9);
    let custom_slug: Option<String> = kit_row.get(10);
    let views: i32 = kit_row.get(11);
    let downloads: i32 = kit_row.get(12);
    let show_rates: bool = kit_row.get(13);
    let brand_color_primary: String = kit_row.get(14);
    let brand_color_secondary: String = kit_row.get(15);
    let brand_color_accent: String = kit_row.get(16);

    let specialties: Vec<&str> = specialties_str.split(',').filter(|s| !s.is_empty()).collect();
    let languages: Vec<&str> = languages_str.split(',').filter(|s| !s.is_empty()).collect();

    HttpResponse::Ok().json(serde_json::json!({
        "id": kit_id,
        "tagline": tagline,
        "bio": bio,
        "location": location,
        "niche": niche,
        "specialties": specialties,
        "total_followers": total_followers,
        "avg_engagement_rate": avg_engagement_rate,
        "monthly_reach": monthly_reach,
        "is_public": is_public,
        "custom_slug": custom_slug,
        "views": views,
        "downloads": downloads,
        "show_rates": show_rates,
        "brand_colors": {
            "primary": brand_color_primary,
            "secondary": brand_color_secondary,
            "accent": brand_color_accent
        },
        "languages": languages,
        "public_url": format!("/creators/{}", custom_slug.as_deref().unwrap_or(
            username.as_ref().map(|u| u.0.as_str()).unwrap_or("unknown")
        )),
        "rates": rates.iter().map(|r| serde_json::json!({
            "id": r.0, "type": r.1, "platform": r.2, "price_cents": r.3, "description": r.4
        })).collect::<Vec<_>>(),
        "featured_content": content.iter().map(|c| serde_json::json!({
            "id": c.0, "platform": c.1, "content_type": c.2, "thumbnail_url": c.3,
            "url": c.4, "views": c.5, "likes": c.6, "comments": c.7
        })).collect::<Vec<_>>(),
        "collaborations": collabs.iter().map(|c| serde_json::json!({
            "id": c.0, "brand_name": c.1, "campaign_type": c.2, "results": c.3, "date": c.4
        })).collect::<Vec<_>>()
    }))
}

#[derive(Deserialize)]
pub struct UpdateMediaKitBody {
    pub tagline: Option<String>,
    pub bio: Option<String>,
    pub location: Option<String>,
    pub niche: Option<String>,
    pub show_rates: Option<bool>,
    pub is_public: Option<bool>,
    pub custom_slug: Option<String>,
    pub brand_color_primary: Option<String>,
    pub brand_color_secondary: Option<String>,
    pub brand_color_accent: Option<String>,
}

/// PATCH /mediakit/me — update media kit fields
pub async fn update_mediakit(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<UpdateMediaKitBody>,
) -> impl Responder {
    let user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };

    // Build dynamic update
    let result = sqlx::query(
        "UPDATE creator_media_kits SET
            tagline = COALESCE($2, tagline),
            bio = COALESCE($3, bio),
            location = COALESCE($4, location),
            niche = COALESCE($5, niche),
            show_rates = COALESCE($6, show_rates),
            is_public = COALESCE($7, is_public),
            custom_slug = COALESCE($8, custom_slug),
            brand_color_primary = COALESCE($9, brand_color_primary),
            brand_color_secondary = COALESCE($10, brand_color_secondary),
            brand_color_accent = COALESCE($11, brand_color_accent),
            updated_at = NOW()
         WHERE user_id = $1"
    )
    .bind(user_id)
    .bind(&body.tagline)
    .bind(&body.bio)
    .bind(&body.location)
    .bind(&body.niche)
    .bind(body.show_rates)
    .bind(body.is_public)
    .bind(&body.custom_slug)
    .bind(&body.brand_color_primary)
    .bind(&body.brand_color_secondary)
    .bind(&body.brand_color_accent)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"updated": true})),
        Err(e) => {
            tracing::error!(error = %e, "Failed to update media kit");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Update failed"}))
        }
    }
}

/// GET /mediakit/public/{slug} — public media kit view (no auth)
pub async fn get_public_mediakit(
    pool: web::Data<PgPool>,
    path: web::Path<String>,
) -> impl Responder {
    let slug = path.into_inner();

    // Increment view count
    let kit: Option<(i32, i32)> = sqlx::query_as(
        "UPDATE creator_media_kits SET views = views + 1
         WHERE custom_slug = $1 AND is_public = true
         RETURNING id, user_id"
    )
    .bind(&slug)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    let (kit_id, user_id) = match kit {
        Some(k) => (k.0, k.1),
        None => return HttpResponse::NotFound().json(serde_json::json!({"error": "Media kit not found"})),
    };

    // Fetch same data as get_my_mediakit but without auth
    let data: Option<(String, String, Option<String>, String, i64, f64, String, String, String, bool)> =
        sqlx::query_as(
            "SELECT tagline, bio, location, niche, total_followers,
                    avg_engagement_rate::float8,
                    brand_color_primary, brand_color_secondary, brand_color_accent,
                    show_rates
             FROM creator_media_kits WHERE id = $1"
        )
        .bind(kit_id)
        .fetch_optional(pool.get_ref())
        .await
        .unwrap_or(None);

    let data = match data {
        Some(d) => d,
        None => return HttpResponse::NotFound().json(serde_json::json!({"error": "Not found"})),
    };

    let rates = if data.9 {
        sqlx::query_as::<_, (String, String, i64, String)>(
            "SELECT rate_type, platform, price_cents, description
             FROM mediakit_rates WHERE mediakit_id = $1 ORDER BY id"
        )
        .bind(kit_id)
        .fetch_all(pool.get_ref())
        .await
        .unwrap_or_default()
    } else {
        vec![]
    };

    let creator_name: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT username, display_name FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    HttpResponse::Ok().json(serde_json::json!({
        "creator_name": creator_name.as_ref().map(|c| c.1.as_deref().unwrap_or(&c.0)),
        "tagline": data.0,
        "bio": data.1,
        "location": data.2,
        "niche": data.3,
        "total_followers": data.4,
        "avg_engagement_rate": data.5,
        "brand_colors": { "primary": data.6, "secondary": data.7, "accent": data.8 },
        "rates": rates.iter().map(|r| serde_json::json!({
            "type": r.0, "platform": r.1, "price_cents": r.2, "description": r.3
        })).collect::<Vec<_>>()
    }))
}
