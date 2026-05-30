use actix_web::{web, HttpResponse, Responder};
use recommendation_service::service::RecommendationService;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct RecommendationsQuery {
    score: i32,
    category: Option<String>,
}

pub async fn get_matching_brands(
    web::Query(info): web::Query<RecommendationsQuery>,
    service: web::Data<RecommendationService>,
) -> impl Responder {
    match service.get_matching_brands(info.score, info.category).await {
        Ok(brands) => HttpResponse::Ok().json(brands),
        Err(_) => HttpResponse::InternalServerError().finish(),
    }
}
