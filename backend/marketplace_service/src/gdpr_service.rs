//! GDPR Data Deletion Service
//!
//! Implements the Right to Erasure (GDPR Art. 17).
//! Anonymizes user data in a controlled, auditable sequence.
//!
//! Invariants:
//! - Only one active deletion request per user (enforced by DB UNIQUE constraint)
//! - Deletion is soft-first: mark anonymized, then batch hard-delete after retention period
//! - Immutable records (completed_deals, payout_ledger, audit logs) retain anonymized IDs
//! - All steps logged to data_deletion_requests.deleted_tables

use sqlx::PgPool;
use chrono::Utc;

#[derive(Debug)]
pub enum GdprError {
    AlreadyRequested,
    NotFound,
    /// User has active deal rooms or pending escrow — cannot delete yet
    ActiveDealsExist { count: i64 },
    /// Scope value is not recognized
    InvalidScope,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for GdprError {
    fn from(e: sqlx::Error) -> Self {
        GdprError::Database(e)
    }
}

pub struct GdprService {
    pool: PgPool,
}

impl GdprService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Submit a data deletion request for the authenticated user.
    /// Returns the request ID.
    const VALID_SCOPES: [&'static str; 3] = ["full", "pii_only", "content_only"];

    pub async fn request_deletion(
        &self,
        user_id: i64,
        scope: &str,
        reason: Option<&str>,
    ) -> Result<i64, GdprError> {
        // Validate scope enum
        if !Self::VALID_SCOPES.contains(&scope) {
            return Err(GdprError::InvalidScope);
        }

        // CRITICAL: Block deletion if user has active deal rooms or pending escrow.
        // At Meta scale, orphaned deals with funds in escrow = legal liability.
        // User must complete or cancel all deals before requesting deletion.
        let active_deals: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM deal_rooms
             WHERE (creator_user_id = $1 OR brand_user_id = $1)
               AND status NOT IN ('completed', 'cancelled', 'disputed_resolved')"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        if active_deals > 0 {
            return Err(GdprError::ActiveDealsExist { count: active_deals });
        }

        // Check for existing active request
        let existing: Option<i64> = sqlx::query_scalar(
            "SELECT id FROM data_deletion_requests WHERE user_id = $1 AND status IN ('pending','processing')"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        if existing.is_some() {
            return Err(GdprError::AlreadyRequested);
        }

        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO data_deletion_requests (user_id, scope, reason, status)
            VALUES ($1, $2, $3, 'pending')
            RETURNING id
            "#
        )
        .bind(user_id)
        .bind(scope)
        .bind(reason)
        .fetch_one(&self.pool)
        .await?;

        Ok(id)
    }

    /// Get status of a user's deletion request.
    pub async fn get_deletion_status(
        &self,
        user_id: i64,
    ) -> Result<Option<serde_json::Value>, GdprError> {
        let row = sqlx::query(
            r#"
            SELECT id, scope, status, requested_at, must_complete_by,
                   completed_at, deleted_tables
            FROM data_deletion_requests
            WHERE user_id = $1
            ORDER BY requested_at DESC
            LIMIT 1
            "#
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            use sqlx::Row;
            Ok(Some(serde_json::json!({
                "id": row.try_get::<i64, _>("id").unwrap_or(0),
                "scope": row.try_get::<String, _>("scope").unwrap_or_default(),
                "status": row.try_get::<String, _>("status").unwrap_or_default(),
                "requested_at": row.try_get::<chrono::DateTime<Utc>, _>("requested_at").ok(),
                "must_complete_by": row.try_get::<chrono::DateTime<Utc>, _>("must_complete_by").ok(),
                "completed_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("completed_at").ok().flatten(),
            })))
        } else {
            Ok(None)
        }
    }

    /// Cancel a pending deletion request (user changed their mind).
    pub async fn cancel_deletion(&self, user_id: i64) -> Result<(), GdprError> {
        let rows_affected = sqlx::query(
            "UPDATE data_deletion_requests SET status = 'cancelled' WHERE user_id = $1 AND status = 'pending'"
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        if rows_affected == 0 {
            Err(GdprError::NotFound)
        } else {
            Ok(())
        }
    }

    /// Execute the deletion. Called by a background job or admin.
    /// Anonymizes in a transaction to ensure atomicity.
    ///
    /// Anonymization strategy:
    /// - PII fields → replaced with deterministic placeholder (e.g., "DELETED_USER_<hash>")
    /// - Content deleted: posts, testimonials, credentials, community posts
    /// - Immutable records (deals, payouts) retain anonymized user_id
    /// - User row soft-deleted: is_active=false, email/username blanked
    pub async fn process_deletion(
        &self,
        request_id: i64,
        user_id: i64,
        processed_by: &str,
    ) -> Result<(), GdprError> {
        // Defense-in-depth: re-check active deals even though request_deletion
        // already checked. A deal could have been created between request and processing.
        let active_deals: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM deal_rooms
             WHERE (creator_user_id = $1 OR brand_user_id = $1)
               AND status NOT IN ('completed', 'cancelled', 'disputed_resolved')"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        if active_deals > 0 {
            // Revert to pending — background job will retry later
            sqlx::query(
                "UPDATE data_deletion_requests SET status='pending' WHERE id=$1"
            )
            .bind(request_id)
            .execute(&self.pool)
            .await?;
            return Err(GdprError::ActiveDealsExist { count: active_deals });
        }

        let mut deleted_tables: Vec<String> = Vec::new();
        let anon_suffix = format!("DELETED_{}", &format!("{:x}", user_id)[..8.min(format!("{:x}", user_id).len())]);

        // Use a transaction so partial deletion never leaves the DB in a bad state
        let mut tx = self.pool.begin().await?;

        // Mark as processing
        sqlx::query(
            "UPDATE data_deletion_requests SET status='processing', processing_started_at=NOW() WHERE id=$1"
        )
        .bind(request_id)
        .execute(&mut *tx)
        .await?;

        // 1. Delete credentials (no business value after departure)
        sqlx::query("DELETE FROM creator_credentials WHERE user_id = $1")
            .bind(user_id).execute(&mut *tx).await?;
        deleted_tables.push("creator_credentials".to_string());

        sqlx::query("DELETE FROM identity_proofs WHERE user_id = $1")
            .bind(user_id).execute(&mut *tx).await?;
        deleted_tables.push("identity_proofs".to_string());

        // 2. Delete community posts (user's content)
        sqlx::query("DELETE FROM community_posts WHERE author_user_id = $1")
            .bind(user_id).execute(&mut *tx).await?;
        deleted_tables.push("community_posts".to_string());

        // 3. Remove from communities
        sqlx::query("DELETE FROM community_members WHERE user_id = $1")
            .bind(user_id).execute(&mut *tx).await?;
        deleted_tables.push("community_members".to_string());

        // 4. Delete persona titles
        sqlx::query(
            "DELETE FROM persona_titles WHERE persona_id IN (SELECT id FROM personas WHERE owner_user_id = $1)"
        )
        .bind(user_id).execute(&mut *tx).await?;
        deleted_tables.push("persona_titles".to_string());

        // 5. Anonymize testimonials (public record, but remove identity)
        sqlx::query(
            "UPDATE testimonials SET reviewer_note = '[removed]', brand_contact_name = $2 WHERE creator_user_id = $1"
        )
        .bind(user_id)
        .bind(&anon_suffix)
        .execute(&mut *tx).await?;
        deleted_tables.push("testimonials (anonymized)".to_string());

        // 6. Anonymize user PII — keep the row for FK integrity in deals/payouts
        sqlx::query(
            r#"
            UPDATE users SET
                email = $2 || '@deleted.invalid',
                username = $2,
                display_name = '[Deleted User]',
                avatar_url = NULL,
                is_active = FALSE,
                updated_at = NOW()
            WHERE id = $1
            "#
        )
        .bind(user_id)
        .bind(&anon_suffix)
        .execute(&mut *tx).await?;
        deleted_tables.push("users (anonymized)".to_string());

        // 7. Mark deletion complete
        sqlx::query(
            r#"
            UPDATE data_deletion_requests SET
                status = 'completed',
                completed_at = NOW(),
                deleted_tables = $2,
                processed_by = $3
            WHERE id = $1
            "#
        )
        .bind(request_id)
        .bind(&deleted_tables)
        .bind(processed_by)
        .execute(&mut *tx).await?;

        tx.commit().await?;
        Ok(())
    }
}
