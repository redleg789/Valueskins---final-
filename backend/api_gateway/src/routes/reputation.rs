use actix_web::{web, HttpResponse, Responder};
use serde::Serialize;
use sqlx::PgPool;
use reputation_service::calculator::{ReputationCalculator, ReputationScore};

#[derive(Debug, Serialize)]
pub struct ReputationResponse {
    pub score: i32,
    pub risk_tier: String,
    pub on_time_rate: f32,
    pub avg_rating: f32,
    pub response_score: f32,
    pub revision_efficiency: f32,
    pub repeat_brand_rate: f32,
    pub max_deal_size: i32,
    pub completed_deals: i32,
    pub dispute_count: i32,
}

/// GET /api/v1/creators/{creator_id}/reputation
pub async fn get_creator_reputation(
    pool: web::Data<PgPool>,
    path: web::Path<String>,
) -> impl Responder {
    let creator_id = path.into_inner();
    let calculator = ReputationCalculator::new((**pool).clone());

    match calculator.get_or_calculate(&creator_id).await {
        Ok(score) => {
            let response = ReputationResponse {
                score: score.score,
                risk_tier: score.risk_tier,
                on_time_rate: score.on_time_rate,
                avg_rating: score.avg_rating,
                response_score: score.response_score,
                revision_efficiency: score.revision_efficiency,
                repeat_brand_rate: score.repeat_brand_rate,
                max_deal_size: score.max_deal_size,
                completed_deals: score.completed_deals,
                dispute_count: score.dispute_count,
            };
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            tracing::error!("Reputation calculation error: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to calculate reputation"
            }))
        }
    }
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.route("/{creator_id}/reputation", web::get().to(get_creator_reputation));
}
