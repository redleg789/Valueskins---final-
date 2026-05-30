use actix_web::{web, HttpResponse, Responder};
use ai_service::scoring::{calculate_score, ScoringInput};

pub async fn get_score(req: web::Json<ScoringInput>) -> impl Responder {
    let result = calculate_score(&req);
    HttpResponse::Ok().json(result)
}
