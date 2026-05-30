//! SendGrid Email Integration — transactional emails for deals, disputes, payouts

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailTemplate {
    pub template_id: String,
    pub subject: String,
    pub template_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendEmailRequest {
    pub to: String,
    pub template_id: String,
    pub dynamic_data: serde_json::Value,
    pub from: Option<String>,
    pub reply_to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailResponse {
    pub message_id: String,
    pub status: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug)]
pub enum NotificationError {
    NotConfigured,
    InvalidEmail,
    TemplateNotFound,
    SendFailed(String),
    RateLimited,
}

pub struct SendGridService {
    api_key: String,
    from_email: String,
    http_client: reqwest::Client,
}

impl SendGridService {
    pub fn new(api_key: String, from_email: String) -> Self {
        Self {
            api_key,
            from_email,
            http_client: reqwest::Client::new(),
        }
    }

    /// Send transactional email via SendGrid
    pub async fn send_email(&self, req: SendEmailRequest) -> Result<EmailResponse, NotificationError> {
        if self.api_key.is_empty() {
            return Err(NotificationError::NotConfigured);
        }

        if !req.to.contains('@') {
            return Err(NotificationError::InvalidEmail);
        }

        // SendGrid API payload
        #[derive(Serialize)]
        struct SendGridPayload {
            personalizations: Vec<Personalization>,
            from: From,
            template_id: String,
        }

        #[derive(Serialize)]
        struct Personalization {
            to: Vec<Email>,
            dynamic_template_data: serde_json::Value,
        }

        #[derive(Serialize)]
        struct Email {
            email: String,
        }

        #[derive(Serialize)]
        struct From {
            email: String,
        }

        let payload = SendGridPayload {
            personalizations: vec![Personalization {
                to: vec![Email {
                    email: req.to.clone(),
                }],
                dynamic_template_data: req.dynamic_data,
            }],
            from: From {
                email: req.from.unwrap_or(self.from_email.clone()),
            },
            template_id: req.template_id,
        };

        let response = self.http_client
            .post("https://api.sendgrid.com/v3/mail/send")
            .bearer_auth(&self.api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|e| NotificationError::SendFailed(e.to_string()))?;

        match response.status().as_u16() {
            202 => {
                // Success
                Ok(EmailResponse {
                    message_id: uuid::Uuid::new_v4().to_string(),
                    status: "sent".to_string(),
                    timestamp: chrono::Utc::now(),
                })
            },
            401 => Err(NotificationError::NotConfigured),
            429 => Err(NotificationError::RateLimited),
            400 => Err(NotificationError::InvalidEmail),
            _ => Err(NotificationError::SendFailed(format!("HTTP {}", response.status()))),
        }
    }

    /// Deal offer notification
    pub async fn send_deal_offer(
        &self,
        creator_email: &str,
        creator_name: &str,
        brand_name: &str,
        amount: i64,
        deal_link: &str,
    ) -> Result<EmailResponse, NotificationError> {
        let dynamic_data = serde_json::json!({
            "creator_name": creator_name,
            "brand_name": brand_name,
            "amount": format!("${:.2}", amount as f64 / 100.0),
            "deal_link": deal_link,
            "action_url": format!("https://valueskins.com/deals?ref={}", uuid::Uuid::new_v4()),
        });

        self.send_email(SendEmailRequest {
            to: creator_email.to_string(),
            template_id: "d-deal_offer_notification".to_string(),
            dynamic_data,
            from: None,
            reply_to: None,
        }).await
    }

    /// Deal accepted notification
    pub async fn send_deal_accepted(
        &self,
        brand_email: &str,
        brand_name: &str,
        creator_name: &str,
        amount: i64,
    ) -> Result<EmailResponse, NotificationError> {
        let dynamic_data = serde_json::json!({
            "brand_name": brand_name,
            "creator_name": creator_name,
            "amount": format!("${:.2}", amount as f64 / 100.0),
            "next_steps": "Creator will submit deliverables within the agreed timeline",
        });

        self.send_email(SendEmailRequest {
            to: brand_email.to_string(),
            template_id: "d-deal_accepted_notification".to_string(),
            dynamic_data,
            from: None,
            reply_to: None,
        }).await
    }

    /// Dispute filed notification
    pub async fn send_dispute_notification(
        &self,
        recipient_email: &str,
        recipient_name: &str,
        deal_id: i64,
        dispute_type: &str,
    ) -> Result<EmailResponse, NotificationError> {
        let dynamic_data = serde_json::json!({
            "recipient_name": recipient_name,
            "deal_id": deal_id,
            "dispute_type": dispute_type,
            "admin_review_time": "48 hours",
            "review_link": format!("https://valueskins.com/admin/disputes/{}", deal_id),
        });

        self.send_email(SendEmailRequest {
            to: recipient_email.to_string(),
            template_id: "d-dispute_filed_notification".to_string(),
            dynamic_data,
            from: None,
            reply_to: None,
        }).await
    }

    /// Payout notification
    pub async fn send_payout_notification(
        &self,
        creator_email: &str,
        creator_name: &str,
        amount: i64,
        payout_date: &str,
    ) -> Result<EmailResponse, NotificationError> {
        let dynamic_data = serde_json::json!({
            "creator_name": creator_name,
            "amount": format!("${:.2}", amount as f64 / 100.0),
            "payout_date": payout_date,
            "view_payout_link": "https://valueskins.com/creator/earnings",
        });

        self.send_email(SendEmailRequest {
            to: creator_email.to_string(),
            template_id: "d-payout_notification".to_string(),
            dynamic_data,
            from: None,
            reply_to: None,
        }).await
    }

    /// Weekly digest
    pub async fn send_weekly_digest(
        &self,
        user_email: &str,
        user_name: &str,
        stats: WeeklyStats,
    ) -> Result<EmailResponse, NotificationError> {
        let dynamic_data = serde_json::json!({
            "user_name": user_name,
            "new_offers": stats.new_offers,
            "active_deals": stats.active_deals,
            "earnings_this_week": format!("${:.2}", stats.earnings_cents as f64 / 100.0),
            "dashboard_link": "https://valueskins.com/dashboard",
        });

        self.send_email(SendEmailRequest {
            to: user_email.to_string(),
            template_id: "d-weekly_digest".to_string(),
            dynamic_data,
            from: None,
            reply_to: None,
        }).await
    }
}

#[derive(Debug, Clone)]
pub struct WeeklyStats {
    pub new_offers: i32,
    pub active_deals: i32,
    pub earnings_cents: i64,
}

/// In-app notification (stored in database)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InAppNotification {
    pub id: String,
    pub user_id: i64,
    pub title: String,
    pub body: String,
    pub notification_type: String, // "deal_offer", "dispute", "payout", etc
    pub related_deal_id: Option<i64>,
    pub read: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

impl InAppNotification {
    pub fn new(
        user_id: i64,
        title: String,
        body: String,
        notification_type: String,
    ) -> Self {
        let now = chrono::Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            user_id,
            title,
            body,
            notification_type,
            related_deal_id: None,
            read: false,
            created_at: now,
            expires_at: now + chrono::Duration::days(30),
        }
    }
}
