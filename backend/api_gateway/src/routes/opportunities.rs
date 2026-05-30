use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use marketplace_service::opportunity_source::{
    OpportunityQuery, OpportunitySourceFactory,
};

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
    pub budget_min: i32,
    pub budget_max: i32,
    pub timeline_days: i32,
    pub deliverables: String,
    pub brief_url: Option<String>,
    pub script_required: bool,
    pub script_mode: Option<String>,
    pub script_text: Option<String>,
    pub required_professions: Vec<String>,
    pub required_followers_min: Option<i64>,
    pub status: String,
    pub applications_count: i32,
    pub created_at: String,
    pub deadline_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpportunityListResponse {
    pub opportunities: Vec<OpportunityResponse>,
    pub total: usize,
}

/// GET /api/v1/opportunities/search
pub async fn search_opportunities(
    pool: web::Data<PgPool>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    let source = OpportunitySourceFactory::create_database((**pool).clone());

    let platform = query.get("platform").cloned().unwrap_or_default();
    if platform.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "platform parameter required"
        }));
    }

    let opp_query = OpportunityQuery {
        platform,
        profession: query.get("profession").cloned(),
        min_budget: query.get("min_budget").and_then(|b| b.parse().ok()),
        max_budget: query.get("max_budget").and_then(|b| b.parse().ok()),
        deal_type: query.get("deal_type").cloned(),
        status: query.get("status").cloned().unwrap_or_else(|| "open".to_string()),
        limit: query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20),
        offset: query.get("offset").and_then(|o| o.parse().ok()).unwrap_or(0),
    };

    match source.search_opportunities(opp_query).await {
        Ok(opportunities) => {
            let responses: Vec<OpportunityResponse> = opportunities
                .into_iter()
                .map(|o| OpportunityResponse {
                    id: o.id,
                    platform: o.platform,
                    brand_id: o.brand_id,
                    brand_name: o.brand_name,
                    title: o.title,
                    description: o.description,
                    category: o.category,
                    deal_type: o.deal_type,
                    budget_min: o.budget_min,
                    budget_max: o.budget_max,
                    timeline_days: o.timeline_days,
                    deliverables: o.deliverables,
                    brief_url: o.brief_url,
                    script_required: o.script_required,
                    script_mode: o.script_mode,
                    script_text: o.script_text,
                    required_professions: o.required_professions,
                    required_followers_min: o.required_followers_min,
                    status: o.status,
                    applications_count: o.applications_count,
                    created_at: o.created_at.to_rfc3339(),
                    deadline_at: o.deadline_at.to_rfc3339(),
                })
                .collect();

            let total = responses.len();
            HttpResponse::Ok().json(OpportunityListResponse {
                opportunities: responses,
                total,
            })
        }
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

/// GET /api/v1/opportunities/{opportunity_id}
pub async fn get_opportunity(
    pool: web::Data<PgPool>,
    path: web::Path<String>,
) -> impl Responder {
    let opportunity_id = path.into_inner();
    let source = OpportunitySourceFactory::create_database((**pool).clone());

    match source.get_opportunity(&opportunity_id).await {
        Ok(opp) => {
            let response = OpportunityResponse {
                id: opp.id,
                platform: opp.platform,
                brand_id: opp.brand_id,
                brand_name: opp.brand_name,
                title: opp.title,
                description: opp.description,
                category: opp.category,
                deal_type: opp.deal_type,
                budget_min: opp.budget_min,
                budget_max: opp.budget_max,
                timeline_days: opp.timeline_days,
                deliverables: opp.deliverables,
                brief_url: opp.brief_url,
                script_required: opp.script_required,
                script_mode: opp.script_mode,
                script_text: opp.script_text,
                required_professions: opp.required_professions,
                required_followers_min: opp.required_followers_min,
                status: opp.status,
                applications_count: opp.applications_count,
                created_at: opp.created_at.to_rfc3339(),
                deadline_at: opp.deadline_at.to_rfc3339(),
            };
            HttpResponse::Ok().json(response)
        }
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

/// GET /api/v1/opportunities/brand/{brand_id}
pub async fn get_brand_opportunities(
    pool: web::Data<PgPool>,
    path: web::Path<String>,
) -> impl Responder {
    let brand_id = path.into_inner();
    let source = OpportunitySourceFactory::create_database((**pool).clone());

    match source.get_brand_opportunities(&brand_id, 50).await {
        Ok(opportunities) => {
            let responses: Vec<OpportunityResponse> = opportunities
                .into_iter()
                .map(|o| OpportunityResponse {
                    id: o.id,
                    platform: o.platform,
                    brand_id: o.brand_id,
                    brand_name: o.brand_name,
                    title: o.title,
                    description: o.description,
                    category: o.category,
                    deal_type: o.deal_type,
                    budget_min: o.budget_min,
                    budget_max: o.budget_max,
                    timeline_days: o.timeline_days,
                    deliverables: o.deliverables,
                    brief_url: o.brief_url,
                    script_required: o.script_required,
                    script_mode: o.script_mode,
                    script_text: o.script_text,
                    required_professions: o.required_professions,
                    required_followers_min: o.required_followers_min,
                    status: o.status,
                    applications_count: o.applications_count,
                    created_at: o.created_at.to_rfc3339(),
                    deadline_at: o.deadline_at.to_rfc3339(),
                })
                .collect();

            let total = responses.len();
            HttpResponse::Ok().json(OpportunityListResponse {
                opportunities: responses,
                total,
            })
        }
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.route("/search", web::get().to(search_opportunities))
        .route("/{opportunity_id}", web::get().to(get_opportunity))
        .route("/brand/{brand_id}", web::get().to(get_brand_opportunities));
}
