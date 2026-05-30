//! Brand Verification Service
//!
//! Brands must verify their business identity before posting opportunities.
//! Verification is OFF by default — unverified brands can't post.
//!
//! State machine:
//!   pending → under_review → verified
//!   pending → under_review → rejected → pending (re-submission)
//!   verified → suspended (enforcement action)
//!
//! Verification is manual by default (admin reviews documents).
//! Platform can add automated checks (domain lookup, companies-house API)
//! without changing the state machine contract.

use sqlx::PgPool;
use chrono::Utc;

#[derive(Debug)]
pub enum BrandVerificationError {
    AlreadyVerified,
    AlreadyPending,
    NotFound,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for BrandVerificationError {
    fn from(e: sqlx::Error) -> Self {
        BrandVerificationError::Database(e)
    }
}

#[derive(Debug, serde::Deserialize)]
pub struct SubmitVerificationRequest {
    pub legal_name: String,
    pub registration_number: Option<String>,
    pub country_code: String,
    pub website_url: Option<String>,
    /// Array of pre-signed storage URLs (not raw uploads)
    pub document_urls: Vec<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct ReviewVerificationRequest {
    pub decision: String,  // "verified" | "rejected"
    pub notes: Option<String>,
}

pub struct BrandVerificationService {
    pool: PgPool,
}

impl BrandVerificationService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Submit a new verification request or re-submit after rejection.
    pub async fn submit(
        &self,
        brand_user_id: i64,
        req: SubmitVerificationRequest,
    ) -> Result<i64, BrandVerificationError> {
        // Check for already-verified or pending
        let current: Option<String> = sqlx::query_scalar(
            "SELECT status FROM brand_verifications WHERE brand_user_id = $1"
        )
        .bind(brand_user_id)
        .fetch_optional(&self.pool)
        .await?;

        match current.as_deref() {
            Some("verified") => return Err(BrandVerificationError::AlreadyVerified),
            Some("pending") | Some("under_review") => return Err(BrandVerificationError::AlreadyPending),
            _ => {}
        }

        // UPSERT: allows re-submission after rejection
        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO brand_verifications
                (brand_user_id, status, legal_name, registration_number, country_code,
                 website_url, document_urls, submitted_at, updated_at)
            VALUES ($1, 'pending', $2, $3, $4, $5, $6, NOW(), NOW())
            ON CONFLICT (brand_user_id) DO UPDATE SET
                status = 'pending',
                legal_name = EXCLUDED.legal_name,
                registration_number = EXCLUDED.registration_number,
                country_code = EXCLUDED.country_code,
                website_url = EXCLUDED.website_url,
                document_urls = EXCLUDED.document_urls,
                submitted_at = NOW(),
                updated_at = NOW(),
                reviewer_user_id = NULL,
                reviewer_notes = NULL,
                verified_at = NULL,
                rejected_at = NULL
            RETURNING id
            "#
        )
        .bind(brand_user_id)
        .bind(&req.legal_name)
        .bind(&req.registration_number)
        .bind(&req.country_code)
        .bind(&req.website_url)
        .bind(&req.document_urls)
        .fetch_one(&self.pool)
        .await?;

        // Audit history
        sqlx::query(
            "INSERT INTO brand_verification_history (brand_user_id, old_status, new_status, reason)
             VALUES ($1, 'none', 'pending', 'initial_submission')"
        )
        .bind(brand_user_id)
        .execute(&self.pool)
        .await?;

        Ok(id)
    }

    /// Get verification status for a brand.
    pub async fn get_status(
        &self,
        brand_user_id: i64,
    ) -> Result<Option<serde_json::Value>, BrandVerificationError> {
        let row = sqlx::query(
            r#"
            SELECT id, status, legal_name, country_code, website_url,
                   submitted_at, verified_at, rejected_at, reviewer_notes
            FROM brand_verifications
            WHERE brand_user_id = $1
            "#
        )
        .bind(brand_user_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            use sqlx::Row;
            Ok(Some(serde_json::json!({
                "id": row.try_get::<i64, _>("id").unwrap_or(0),
                "status": row.try_get::<String, _>("status").unwrap_or_default(),
                "legal_name": row.try_get::<Option<String>, _>("legal_name").ok().flatten(),
                "country_code": row.try_get::<Option<String>, _>("country_code").ok().flatten(),
                "website_url": row.try_get::<Option<String>, _>("website_url").ok().flatten(),
                "submitted_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("submitted_at").ok().flatten(),
                "verified_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("verified_at").ok().flatten(),
                "reviewer_notes": row.try_get::<Option<String>, _>("reviewer_notes").ok().flatten(),
            })))
        } else {
            Ok(None)
        }
    }

    /// Admin reviews and makes a decision.
    pub async fn review(
        &self,
        brand_user_id: i64,
        reviewer_user_id: i64,
        req: ReviewVerificationRequest,
    ) -> Result<(), BrandVerificationError> {
        if req.decision != "verified" && req.decision != "rejected" {
            return Err(BrandVerificationError::NotFound); // invalid decision
        }

        let old_status: Option<String> = sqlx::query_scalar(
            "SELECT status FROM brand_verifications WHERE brand_user_id = $1 AND status IN ('pending','under_review')"
        )
        .bind(brand_user_id)
        .fetch_optional(&self.pool)
        .await?;

        if old_status.is_none() {
            return Err(BrandVerificationError::NotFound);
        }

        let timestamp_col = if req.decision == "verified" { "verified_at" } else { "rejected_at" };

        // Build dynamic query for the timestamp
        let sql = format!(
            "UPDATE brand_verifications SET status = $1, reviewer_user_id = $2, reviewer_notes = $3,
             {} = NOW(), updated_at = NOW() WHERE brand_user_id = $4",
            timestamp_col
        );

        sqlx::query(&sql)
            .bind(&req.decision)
            .bind(reviewer_user_id)
            .bind(&req.notes)
            .bind(brand_user_id)
            .execute(&self.pool)
            .await?;

        // Audit trail
        sqlx::query(
            "INSERT INTO brand_verification_history (brand_user_id, old_status, new_status, changed_by, reason)
             VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(brand_user_id)
        .bind(old_status.unwrap_or_default())
        .bind(&req.decision)
        .bind(reviewer_user_id)
        .bind(req.notes.as_deref().unwrap_or("admin_review"))
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Check if a brand is verified. Used as a gate before creating opportunities.
    pub async fn is_verified(&self, brand_user_id: i64) -> Result<bool, BrandVerificationError> {
        let status: Option<String> = sqlx::query_scalar(
            "SELECT status FROM brand_verifications WHERE brand_user_id = $1"
        )
        .bind(brand_user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(status.as_deref() == Some("verified"))
    }

    /// Admin: list all pending verifications for review queue.
    pub async fn list_pending(
        &self,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<serde_json::Value>, BrandVerificationError> {
        let rows = sqlx::query(
            r#"
            SELECT bv.id, bv.brand_user_id, bv.status, bv.legal_name,
                   bv.country_code, bv.website_url, bv.document_urls,
                   bv.submitted_at, u.email, u.username
            FROM brand_verifications bv
            JOIN users u ON bv.brand_user_id = u.id
            WHERE bv.status IN ('pending', 'under_review')
            ORDER BY bv.submitted_at ASC
            LIMIT $1 OFFSET $2
            "#
        )
        .bind(limit.min(100))
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        use sqlx::Row;
        Ok(rows.iter().map(|r| serde_json::json!({
            "id": r.try_get::<i64, _>("id").unwrap_or(0),
            "brand_user_id": r.try_get::<i64, _>("brand_user_id").unwrap_or(0),
            "status": r.try_get::<String, _>("status").unwrap_or_default(),
            "legal_name": r.try_get::<Option<String>, _>("legal_name").ok().flatten(),
            "country_code": r.try_get::<Option<String>, _>("country_code").ok().flatten(),
            "website_url": r.try_get::<Option<String>, _>("website_url").ok().flatten(),
            "document_urls": r.try_get::<Vec<String>, _>("document_urls").unwrap_or_default(),
            "submitted_at": r.try_get::<Option<chrono::DateTime<Utc>>, _>("submitted_at").ok().flatten(),
            "email": r.try_get::<String, _>("email").unwrap_or_default(),
            "username": r.try_get::<String, _>("username").unwrap_or_default(),
        })).collect())
    }
}
