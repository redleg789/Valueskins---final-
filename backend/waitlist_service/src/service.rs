//! Waitlist Service Core Logic

use sqlx::PgPool;
use sha2::{Sha256, Digest};
use crate::models::*;

pub struct WaitlistService {
    pool: PgPool,
}

impl WaitlistService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn join(&self, req: JoinWaitlistRequest, ip: Option<&str>, ua: Option<&str>) -> Result<JoinWaitlistResponse, ServiceError> {
        // Check if email already exists
        let existing: Option<i32> = sqlx::query_scalar("SELECT position FROM waitlist WHERE email = $1")
            .bind(&req.email).fetch_optional(&self.pool).await?;
        
        if let Some(pos) = existing {
            return Err(ServiceError::AlreadyExists(pos));
        }

        // Insert new entry (position assigned by trigger)
        let entry: (i64, i32) = sqlx::query_as(
            r#"INSERT INTO waitlist (email, creator_type, follower_range, platforms, referral_code, utm_source, utm_medium, utm_campaign, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, position"#
        )
        .bind(&req.email).bind(&req.creator_type).bind(&req.follower_range)
        .bind(&req.platforms).bind(&req.referral_code).bind(&req.utm_source)
        .bind(&req.utm_medium).bind(&req.utm_campaign).bind(ip).bind(ua)
        .fetch_one(&self.pool).await?;

        // Generate referral code from email hash
        let ref_code = generate_referral_code(&req.email);
        
        // If referred, credit the referrer
        if let Some(ref_code_used) = &req.referral_code {
            let _ = self.credit_referrer(ref_code_used, entry.0).await;
        }

        Ok(JoinWaitlistResponse {
            position: entry.1,
            referral_code: ref_code.clone(),
            share_url: format!("https://valueskins.io?ref={}", ref_code),
            ahead_count: entry.1 - 1,
        })
    }

    async fn credit_referrer(&self, ref_code: &str, _new_id: i64) -> Result<(), ServiceError> {
        // Find the referrer whose generated referral code matches, bump them up 5 positions.
        // The referral code is a SHA-256 prefix of the referrer's email, stored implicitly.
        // We look up all waitlist entries and check their generated code.
        // More efficient: store the referral code as a column. For now, match by regenerating.
        let all_emails: Vec<String> = sqlx::query_scalar(
            "SELECT email FROM waitlist ORDER BY position LIMIT 10000"
        )
        .fetch_all(&self.pool)
        .await?;

        for email in &all_emails {
            if generate_referral_code(email) == ref_code {
                sqlx::query(
                    "UPDATE waitlist SET position = GREATEST(position - 5, 1) WHERE email = $1"
                )
                .bind(email)
                .execute(&self.pool)
                .await?;
                break;
            }
        }
        Ok(())
    }

    pub async fn get_position(&self, email: &str) -> Result<PositionResponse, ServiceError> {
        let entry: Option<(i32, DateTime<chrono::Utc>)> = sqlx::query_as(
            "SELECT position, created_at FROM waitlist WHERE email = $1"
        ).bind(email).fetch_optional(&self.pool).await?;

        match entry {
            Some((pos, _)) => {
                let ahead: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM waitlist WHERE position < $1")
                    .bind(pos).fetch_one(&self.pool).await?;
                Ok(PositionResponse { position: pos, ahead_count: ahead as i32, referrals_made: 0, positions_jumped: 0 })
            }
            None => Err(ServiceError::NotFound),
        }
    }

    pub async fn get_stats(&self) -> Result<WaitlistStats, ServiceError> {
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM waitlist").fetch_one(&self.pool).await?;
        let verified: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM waitlist WHERE is_verified = true").fetch_one(&self.pool).await?;
        let referral: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM waitlist WHERE referral_code IS NOT NULL").fetch_one(&self.pool).await?;
        let converted: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM waitlist WHERE converted_to_user = true").fetch_one(&self.pool).await?;

        Ok(WaitlistStats {
            total_signups: total,
            verified_signups: verified,
            referral_signups: referral,
            conversion_rate: if total > 0 { (converted as f64) / (total as f64) } else { 0.0 },
            top_creator_types: vec![],
            top_platforms: vec![],
        })
    }
}

fn generate_referral_code(email: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(email.as_bytes());
    let hash = format!("{:x}", hasher.finalize());
    hash[..8].to_uppercase()
}

use chrono::DateTime;

#[derive(Debug)]
pub enum ServiceError {
    AlreadyExists(i32),
    NotFound,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for ServiceError {
    fn from(e: sqlx::Error) -> Self { ServiceError::Database(e) }
}
