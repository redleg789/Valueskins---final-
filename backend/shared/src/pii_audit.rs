//! PII Access Audit Logger
//!
//! GDPR Article 30 requires a record of processing activities.
//! Every time PII is accessed (read or written), this logger creates
//! an immutable audit entry: who accessed what, when, why.
//!
//! The audit log is append-only — no UPDATEs or DELETEs allowed.

use sqlx::PgPool;

pub struct PiiAuditLogger {
    pool: PgPool,
}

impl PiiAuditLogger {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Log a PII access event.
    /// `accessor_id`: user ID of the person/system accessing PII
    /// `target_user_id`: user whose PII was accessed
    /// `action`: "read", "write", "export", "delete"
    /// `fields_accessed`: which PII fields (e.g., "email,display_name")
    /// `reason`: why (e.g., "admin_user_lookup", "gdpr_export", "deal_completion")
    /// `ip_address`: requester's IP
    pub async fn log(
        &self,
        accessor_id: i64,
        target_user_id: i64,
        action: &str,
        fields_accessed: &str,
        reason: &str,
        ip_address: Option<&str>,
        correlation_id: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO pii_audit_log
             (accessor_user_id, target_user_id, action, fields_accessed, reason, ip_address, correlation_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)"
        )
        .bind(accessor_id)
        .bind(target_user_id)
        .bind(action)
        .bind(fields_accessed)
        .bind(reason)
        .bind(ip_address)
        .bind(correlation_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Query audit log for a specific user's PII access history (paginated).
    pub async fn get_access_history(
        &self,
        target_user_id: i64,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<serde_json::Value>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT accessor_user_id, action, fields_accessed, reason, ip_address, accessed_at
             FROM pii_audit_log
             WHERE target_user_id = $1
             ORDER BY accessed_at DESC
             LIMIT $2 OFFSET $3"
        )
        .bind(target_user_id)
        .bind(limit.min(100))
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        use sqlx::Row;
        Ok(rows.iter().map(|r| {
            serde_json::json!({
                "accessor_user_id": r.try_get::<i64, _>("accessor_user_id").unwrap_or(0),
                "action": r.try_get::<String, _>("action").unwrap_or_default(),
                "fields_accessed": r.try_get::<String, _>("fields_accessed").unwrap_or_default(),
                "reason": r.try_get::<String, _>("reason").unwrap_or_default(),
                "ip_address": r.try_get::<Option<String>, _>("ip_address").ok().flatten(),
                "accessed_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("accessed_at").ok(),
            })
        }).collect())
    }
}
