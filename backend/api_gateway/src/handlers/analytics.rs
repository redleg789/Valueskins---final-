use actix_web::{web, HttpResponse, Responder};
use analytics_service::service::AnalyticsService;
use analytics_service::model::CreateEventRequest;

pub async fn log_event(
    req: web::Json<CreateEventRequest>,
    service: web::Data<AnalyticsService>,
) -> impl Responder {
    match service.log_event(req.into_inner()).await {
        Ok(_) => HttpResponse::Ok().finish(),
        Err(_) => HttpResponse::InternalServerError().finish(),
    }
}
