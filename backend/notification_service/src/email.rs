//! Email sending with templates

use lettre::{Message, AsyncSmtpTransport, AsyncTransport, Tokio1Executor};
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use handlebars::Handlebars;
use std::collections::HashMap;

pub struct EmailService {
    smtp: AsyncSmtpTransport<Tokio1Executor>,
    templates: Handlebars<'static>,
    from_email: String,
    from_name: String,
}

impl EmailService {
    pub fn new(smtp_host: &str, smtp_user: &str, smtp_pass: &str, from_email: &str) -> Self {
        let creds = Credentials::new(smtp_user.to_string(), smtp_pass.to_string());
        let smtp = AsyncSmtpTransport::<Tokio1Executor>::relay(smtp_host)
            .unwrap()
            .credentials(creds)
            .build();

        let mut templates = Handlebars::new();
        templates.register_template_string("waitlist_welcome", include_str!("../templates/waitlist_welcome.html")).unwrap();
        templates.register_template_string("opportunity_match", include_str!("../templates/opportunity_match.html")).unwrap();
        templates.register_template_string("deal_completed", include_str!("../templates/deal_completed.html")).unwrap();
        templates.register_template_string("level_up", include_str!("../templates/level_up.html")).unwrap();
        templates.register_template_string("referral_reward", include_str!("../templates/referral_reward.html")).unwrap();

        Self {
            smtp,
            templates,
            from_email: from_email.to_string(),
            from_name: "Valueskins".to_string(),
        }
    }

    pub async fn send_waitlist_welcome(&self, to: &str, position: i32, referral_code: &str) -> Result<(), EmailError> {
        let mut data = HashMap::new();
        data.insert("position".to_string(), position.to_string());
        data.insert("referral_code".to_string(), referral_code.to_string());
        data.insert("referral_link".to_string(), format!("https://valueskins.io?ref={}", referral_code));

        self.send("waitlist_welcome", to, "You're on the Valueskins waitlist!", &data).await
    }

    pub async fn send_opportunity_match(&self, to: &str, opportunity_title: &str, reward: &str, brand: &str) -> Result<(), EmailError> {
        let mut data = HashMap::new();
        data.insert("opportunity_title".to_string(), opportunity_title.to_string());
        data.insert("reward".to_string(), reward.to_string());
        data.insert("brand".to_string(), brand.to_string());

        self.send("opportunity_match", to, &format!("New opportunity from {} matches your profile!", brand), &data).await
    }

    pub async fn send_deal_completed(&self, to: &str, amount: &str, brand: &str) -> Result<(), EmailError> {
        let mut data = HashMap::new();
        data.insert("amount".to_string(), amount.to_string());
        data.insert("brand".to_string(), brand.to_string());

        self.send("deal_completed", to, &format!("You just earned ${} from {}!", amount, brand), &data).await
    }

    pub async fn send_level_up(&self, to: &str, new_level: i32, level_name: &str) -> Result<(), EmailError> {
        let mut data = HashMap::new();
        data.insert("new_level".to_string(), new_level.to_string());
        data.insert("level_name".to_string(), level_name.to_string());

        self.send("level_up", to, &format!("You've reached Level {} - {}!", new_level, level_name), &data).await
    }

    pub async fn send_referral_reward(&self, to: &str, amount: &str, referred_name: &str) -> Result<(), EmailError> {
        let mut data = HashMap::new();
        data.insert("amount".to_string(), amount.to_string());
        data.insert("referred_name".to_string(), referred_name.to_string());

        self.send("referral_reward", to, &format!("You earned ${} from referring {}!", amount, referred_name), &data).await
    }

    async fn send(&self, template: &str, to: &str, subject: &str, data: &HashMap<String, String>) -> Result<(), EmailError> {
        let body = self.templates.render(template, data).map_err(|e| EmailError::Template(e.to_string()))?;

        let email = Message::builder()
            .from(format!("{} <{}>", self.from_name, self.from_email).parse().unwrap())
            .to(to.parse().map_err(|_| EmailError::InvalidEmail)?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(body)
            .map_err(|e| EmailError::Build(e.to_string()))?;

        self.smtp.send(email).await.map_err(|e| EmailError::Send(e.to_string()))?;
        Ok(())
    }
}

#[derive(Debug)]
pub enum EmailError {
    Template(String),
    InvalidEmail,
    Build(String),
    Send(String),
}
