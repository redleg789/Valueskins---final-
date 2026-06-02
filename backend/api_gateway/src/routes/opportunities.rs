use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

// TEMPORARILY DISABLED - marketplace_service has compilation errors

#[derive(Debug, Serialize, Deserialize)]
pub struct OpportunityResponse {
    pub id: String,
    pub platform: String,
    pub brand_id: String,
    pub brand_name: String,
    pub title: String,
    pub description: String,
    pub category: String,
    pub deal_type: String,
    pub budget_min: i64,
    pub budget_max: i64,
    pub timeline_days: i32,
    pub deliverables: Vec<String>,
    pub brief_url: Option<String>,
    pub script_required: bool,
    pub script_mode: Option<String>,
    pub script_text: Option<String>,
    pub required_professions: Vec<String>,
    pub required_followers_min: i64,
    pub status: String,
    pub applications_count: i32,
    pub created_at: String,
    pub deadline_at: String,
}

#[derive(Debug, Serialize)]
pub struct OpportunityListResponse {
    pub opportunities: Vec<OpportunityResponse>,
    pub total: usize,
}

pub async fn search_opportunities(
    _pool: web::Data<PgPool>,
    _query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    HttpResponse::ServiceUnavailable().json(serde_json::json!({
        "error": "Opportunities endpoint temporarily disabled"
    }))
}

pub async fn get_opportunity(
    _pool: web::Data<PgPool>,
    _path: web::Path<String>,
) -> impl Responder {
    HttpResponse::ServiceUnavailable().json(serde_json::json!({
        "error": "Opportunities endpoint temporarily disabled"
    }))
}

pub async fn get_brand_opportunities(
    _pool: web::Data<PgPool>,
    _path: web::Path<String>,
) -> impl Responder {
    HttpResponse::ServiceUnavailable().json(serde_json::json!({
        "error": "Opportunities endpoint temporarily disabled"
    }))
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.route("/search", web::get().to(search_opportunities))
        .route("/{opportunity_id}", web::get().to(get_opportunity))
        .route("/brand/{brand_id}", web::get().to(get_brand_opportunities));
}
