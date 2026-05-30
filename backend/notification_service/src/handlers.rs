use actix_web::{web, HttpResponse, Responder};
use crate::email::EmailService;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct SendNotificationRequest {
    pub type_: String,
    pub to: String,
    pub data: serde_json::Value,
}

pub async fn send_notification(
    email_service: web::Data<EmailService>,
    req: web::Json<SendNotificationRequest>,
) -> impl Responder {
    let result = match req.type_.as_str() {
        "waitlist_welcome" => {
            let pos = req.data["position"].as_i64().unwrap_or(0) as i32;
            let code = req.data["referral_code"].as_str().unwrap_or("");
            email_service.send_waitlist_welcome(&req.to, pos, code).await
        },
        "opportunity_match" => {
            let title = req.data["opportunity_title"].as_str().unwrap_or("");
            let reward = req.data["reward"].as_str().unwrap_or("");
            let brand = req.data["brand"].as_str().unwrap_or("");
            email_service.send_opportunity_match(&req.to, title, reward, brand).await
        },
        "deal_completed" => {
            let amount = req.data["amount"].as_str().unwrap_or("");
            let brand = req.data["brand"].as_str().unwrap_or("");
            email_service.send_deal_completed(&req.to, amount, brand).await
        },
        "level_up" => {
            let new_level = req.data["new_level"].as_i64().unwrap_or(1) as i32;
            let level_name = req.data["level_name"].as_str().unwrap_or("");
            email_service.send_level_up(&req.to, new_level, level_name).await
        },
        "referral_reward" => {
            let amount = req.data["amount"].as_str().unwrap_or("");
            let referred_name = req.data["referred_name"].as_str().unwrap_or("");
            email_service.send_referral_reward(&req.to, amount, referred_name).await
        },
        _ => return HttpResponse::BadRequest().json("Invalid notification type"),
    };

    match result {
        Ok(_) => HttpResponse::Ok().json("Notification sent"),
        Err(e) => {
            log::error!("Failed to send email: {:?}", e);
            HttpResponse::InternalServerError().json("Failed to send notification")
        }
    }
}
