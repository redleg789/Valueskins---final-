use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct CreatorInterestSignup {
    pub id: i64,
    pub instagram_handle: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub reason_for_interest: String,
    pub primary_profession: Option<String>,
    pub target_annual_income_usd: Option<i32>,
    pub preferred_platforms: Option<Vec<String>>,
    pub has_existing_audience: bool,
    pub estimated_follower_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub status: String,
    pub converted_user_id: Option<i64>,
    pub contacted_at: Option<DateTime<Utc>>,
    pub contacted_by_user_id: Option<i64>,
    pub admin_notes: Option<String>,
    pub last_updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInterestSignupRequest {
    pub instagram_handle: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub reason_for_interest: String,
    pub primary_profession: Option<String>,
    pub target_annual_income_usd: Option<i32>,
    pub preferred_platforms: Option<Vec<String>>,
    pub has_existing_audience: Option<bool>,
    pub estimated_follower_count: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct InterestSignupResponse {
    pub id: i64,
    pub instagram_handle: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub reason_for_interest: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct InterestStatsResponse {
    pub total_signups: i64,
    pub pending_count: i64,
    pub contacted_count: i64,
    pub converted_count: i64,
    pub rejection_count: i64,
    pub conversion_rate: f64,
    pub avg_time_to_contact_hours: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInterestSignupRequest {
    pub status: Option<String>,
    pub admin_notes: Option<String>,
    pub converted_user_id: Option<i64>,
}

#[derive(Debug)]
pub enum ServiceError {
    DuplicateSignup,
    NotFound,
    InvalidStatus,
    Forbidden,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for ServiceError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => ServiceError::NotFound,
            _ => ServiceError::Database(err),
        }
    }
}

pub struct InterestService {
    pool: PgPool,
}

impl InterestService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Create a new creator interest signup
    pub async fn create_signup(
        &self,
        req: CreateInterestSignupRequest,
    ) -> Result<CreatorInterestSignup, ServiceError> {
        // Normalize Instagram handle (remove @ if present)
        let handle = if req.instagram_handle.starts_with('@') {
            req.instagram_handle[1..].to_lowercase()
        } else {
            req.instagram_handle.to_lowercase()
        };

        // Check if already exists
        let existing: Option<i64> = sqlx::query_scalar(
            "SELECT id FROM creator_interest_signups WHERE instagram_handle = $1"
        )
        .bind(&handle)
        .fetch_optional(&self.pool)
        .await?;

        if existing.is_some() {
            return Err(ServiceError::DuplicateSignup);
        }

        let signup = sqlx::query_as::<_, CreatorInterestSignup>(
            r#"
            INSERT INTO creator_interest_signups (
                instagram_handle, email, name, reason_for_interest,
                primary_profession, target_annual_income_usd, preferred_platforms,
                has_existing_audience, estimated_follower_count, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
            RETURNING *
            "#
        )
        .bind(&handle)
        .bind(&req.email)
        .bind(&req.name)
        .bind(&req.reason_for_interest)
        .bind(&req.primary_profession)
        .bind(req.target_annual_income_usd)
        .bind(&req.preferred_platforms)
        .bind(req.has_existing_audience.unwrap_or(false))
        .bind(req.estimated_follower_count)
        .fetch_one(&self.pool)
        .await?;

        Ok(signup)
    }

    /// Get a signup by ID
    pub async fn get_signup(&self, id: i64) -> Result<CreatorInterestSignup, ServiceError> {
        let signup = sqlx::query_as::<_, CreatorInterestSignup>(
            "SELECT * FROM creator_interest_signups WHERE id = $1"
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;

        Ok(signup)
    }

    /// List all signups with optional filtering
    pub async fn list_signups(
        &self,
        status: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<(Vec<CreatorInterestSignup>, i64), ServiceError> {
        let count: i64 = if let Some(s) = status {
            sqlx::query_scalar("SELECT COUNT(*) FROM creator_interest_signups WHERE status = $1")
                .bind(s)
                .fetch_one(&self.pool)
                .await?
        } else {
            sqlx::query_scalar("SELECT COUNT(*) FROM creator_interest_signups")
                .fetch_one(&self.pool)
                .await?
        };

        let signups = if let Some(s) = status {
            sqlx::query_as::<_, CreatorInterestSignup>(
                "SELECT * FROM creator_interest_signups WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
            )
            .bind(s)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, CreatorInterestSignup>(
                "SELECT * FROM creator_interest_signups ORDER BY created_at DESC LIMIT $1 OFFSET $2"
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await?
        };

        Ok((signups, count))
    }

    /// Update signup status and mark as contacted
    pub async fn contact_signup(
        &self,
        signup_id: i64,
        admin_user_id: i64,
    ) -> Result<CreatorInterestSignup, ServiceError> {
        // Verify signup exists
        let _existing = self.get_signup(signup_id).await?;

        // Update status and contact timestamp
        let signup = sqlx::query_as::<_, CreatorInterestSignup>(
            r#"
            UPDATE creator_interest_signups
            SET status = 'contacted', contacted_at = NOW(), contacted_by_user_id = $2, last_updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(signup_id)
        .bind(admin_user_id)
        .fetch_one(&self.pool)
        .await?;

        // Log audit trail
        let _ = sqlx::query(
            r#"
            INSERT INTO creator_interest_audit (signup_id, old_status, new_status, changed_by_user_id, change_reason)
            VALUES ($1, 'pending', 'contacted', $2, 'Admin marked as contacted')
            "#
        )
        .bind(signup_id)
        .bind(admin_user_id)
        .execute(&self.pool)
        .await;

        Ok(signup)
    }

    /// Mark signup as converted to user
    pub async fn convert_signup(
        &self,
        signup_id: i64,
        user_id: i64,
    ) -> Result<CreatorInterestSignup, ServiceError> {
        let signup = sqlx::query_as::<_, CreatorInterestSignup>(
            r#"
            UPDATE creator_interest_signups
            SET status = 'converted_user', converted_user_id = $2, last_updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(signup_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(signup)
    }

    /// Mark signup as rejected
    pub async fn reject_signup(
        &self,
        signup_id: i64,
        admin_user_id: i64,
        reason: &str,
    ) -> Result<CreatorInterestSignup, ServiceError> {
        let signup = sqlx::query_as::<_, CreatorInterestSignup>(
            r#"
            UPDATE creator_interest_signups
            SET status = 'rejected', admin_notes = $3, contacted_by_user_id = $2, last_updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(signup_id)
        .bind(admin_user_id)
        .bind(reason)
        .fetch_one(&self.pool)
        .await?;

        Ok(signup)
    }

    /// Get analytics/stats
    pub async fn get_stats(&self) -> Result<InterestStatsResponse, ServiceError> {
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM creator_interest_signups")
            .fetch_one(&self.pool)
            .await?;

        let pending: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM creator_interest_signups WHERE status = 'pending'"
        )
        .fetch_one(&self.pool)
        .await?;

        let contacted: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM creator_interest_signups WHERE status = 'contacted'"
        )
        .fetch_one(&self.pool)
        .await?;

        let converted: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM creator_interest_signups WHERE status = 'converted_user'"
        )
        .fetch_one(&self.pool)
        .await?;

        let rejected: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM creator_interest_signups WHERE status = 'rejected'"
        )
        .fetch_one(&self.pool)
        .await?;

        let conversion_rate = if total > 0 {
            (converted as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        let avg_hours: Option<f64> = sqlx::query_scalar(
            r#"
            SELECT AVG(EXTRACT(EPOCH FROM (contacted_at - created_at)) / 3600)
            FROM creator_interest_signups
            WHERE contacted_at IS NOT NULL
            "#
        )
        .fetch_optional(&self.pool)
        .await?
        .flatten();

        Ok(InterestStatsResponse {
            total_signups: total,
            pending_count: pending,
            contacted_count: contacted,
            converted_count: converted,
            rejection_count: rejected,
            conversion_rate,
            avg_time_to_contact_hours: avg_hours,
        })
    }
}
