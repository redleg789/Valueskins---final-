use sqlx::PgPool;
use ed25519_dalek::{SigningKey, Signer, VerifyingKey, Verifier, Signature};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use tracing::info;
use chrono::Utc;
use std::time::Duration;
use crate::models::*;

/// Reputation Passport Service — Meta-scale.
///
/// Fixes: read replica for all reads, timeouts, advisory lock on version allocation,
/// CTE-based stats (no correlated subqueries).
pub struct ReputationService {
    pool: PgPool,
    read_pool: PgPool,
    signing_key: SigningKey,
    verifying_key: VerifyingKey,
}

#[derive(Debug)]
pub enum ReputationError {
    NotFound,
    NotAuthorized,
    InvalidSignature,
    SigningKeyMissing,
    Timeout,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for ReputationError {
    fn from(e: sqlx::Error) -> Self {
        ReputationError::Database(e)
    }
}

async fn with_timeout<T, F>(future: F) -> Result<T, ReputationError>
where
    F: std::future::Future<Output = Result<T, sqlx::Error>>,
{
    match tokio::time::timeout(Duration::from_secs(5), future).await {
        Ok(result) => result.map_err(ReputationError::from),
        Err(_) => Err(ReputationError::Timeout),
    }
}

impl ReputationService {
    pub fn new(pool: PgPool, read_pool: PgPool, signing_key_b64: &str) -> Result<Self, ReputationError> {
        let key_bytes = BASE64.decode(signing_key_b64)
            .map_err(|_| ReputationError::SigningKeyMissing)?;
        if key_bytes.len() != 32 { return Err(ReputationError::SigningKeyMissing); }

        let mut seed = [0u8; 32];
        seed.copy_from_slice(&key_bytes);
        let signing_key = SigningKey::from_bytes(&seed);
        let verifying_key = signing_key.verifying_key();

        Ok(Self { pool, read_pool, signing_key, verifying_key })
    }

    pub fn new_single_pool(pool: PgPool, signing_key_b64: &str) -> Result<Self, ReputationError> {
        Self::new(pool.clone(), pool, signing_key_b64)
    }

    pub fn public_key_b64(&self) -> String {
        BASE64.encode(self.verifying_key.as_bytes())
    }

    /// Generate export — CTE-based stats, advisory lock on version, read replica for reads.
    pub async fn generate_export(
        &self,
        user_id: i64,
        persona_id: i64,
    ) -> Result<ReputationExport, ReputationError> {
        // Ownership check on read replica
        let owns: bool = with_timeout(
            sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM personas WHERE id = $1 AND owner_user_id = $2 AND exists = TRUE)",
            )
            .bind(persona_id).bind(user_id)
            .fetch_one(&self.read_pool)
        ).await?;

        if !owns { return Err(ReputationError::NotAuthorized); }

        // CTE-based stats — single query, no correlated subqueries
        let stats: Option<(i64, i64, f64, f64)> = with_timeout(
            sqlx::query_as(
                r#"WITH creator_deals AS (
                       SELECT cd.final_amount_cents, cd.completion_status, cd.completed_at, cd.deadline
                       FROM completed_deals cd
                       JOIN deal_rooms dr ON cd.deal_room_id = dr.id
                       WHERE dr.creator_user_id = $1
                   )
                   SELECT
                       COUNT(*) FILTER (WHERE completion_status = 'completed') AS deal_count,
                       COALESCE(AVG(final_amount_cents) FILTER (WHERE completion_status = 'completed'), 0)::bigint AS avg_cents,
                       CASE WHEN COUNT(*) > 0
                            THEN COUNT(*) FILTER (WHERE completion_status = 'completed')::float8 / COUNT(*) * 100.0
                            ELSE 0.0 END AS completion_rate,
                       CASE WHEN COUNT(*) FILTER (WHERE completion_status = 'completed') > 0
                            THEN COUNT(*) FILTER (WHERE completion_status = 'completed' AND completed_at <= deadline)::float8
                                 / COUNT(*) FILTER (WHERE completion_status = 'completed') * 100.0
                            ELSE 0.0 END AS on_time_rate
                   FROM creator_deals"#,
            )
            .bind(user_id)
            .fetch_optional(&self.read_pool)
        ).await?;

        let (deal_count, avg_deal_cents, completion_rate, on_time_rate) =
            stats.ok_or(ReputationError::NotFound)?;

        let trust_scores: serde_json::Value = with_timeout(
            sqlx::query_scalar(
                r#"SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'profession', pr.name, 'level', pp.level, 'score', pp.real_score
                   ) ORDER BY pp.level DESC), '[]'::jsonb)
                   FROM persona_professions pp
                   JOIN professions pr ON pp.profession_id = pr.id
                   WHERE pp.persona_id = $1"#,
            )
            .bind(persona_id)
            .fetch_one(&self.read_pool)
        ).await?;

        let testimonial_count: i64 = match with_timeout(
            sqlx::query_scalar(
                r#"SELECT COUNT(*) FROM completed_deals cd
                   JOIN deal_rooms dr ON cd.deal_room_id = dr.id
                   WHERE dr.creator_user_id = $1 AND cd.brand_review IS NOT NULL AND cd.brand_review != ''"#,
            )
            .bind(user_id)
            .fetch_one(&self.read_pool)
        ).await {
            Ok(count) => count,
            Err(e) => {
                tracing::warn!(persona_id, error = ?e, "Failed to fetch testimonial_count — using 0");
                0
            }
        };

        // Write path: advisory lock on persona_id for version allocation
        // Use hashtext(persona_id::text) to safely handle large i64 values without truncation
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock(7394, hashtext($1::text)::int)")
            .bind(persona_id.to_string())
            .execute(&mut *tx).await?;

        let current_version: Option<i32> = sqlx::query_scalar(
            "SELECT MAX(export_version) FROM reputation_exports WHERE persona_id = $1",
        )
        .bind(persona_id)
        .fetch_optional(&mut *tx).await?.flatten();

        let new_version = current_version.unwrap_or(0) + 1;
        let now = Utc::now();

        let payload = ReputationPayload {
            persona_id,
            export_version: new_version,
            deal_count: deal_count as i32,
            avg_deal_cents,
            completion_rate_pct: completion_rate,
            on_time_rate_pct: on_time_rate,
            trust_scores: trust_scores.clone(),
            testimonial_count: testimonial_count as i32,
            generated_at: now,
        };

        let payload_bytes = serde_json::to_vec(&payload)
            .map_err(|_| ReputationError::SigningKeyMissing)?;

        let signature: ed25519_dalek::Signature = self.signing_key.sign(&payload_bytes);
        let signed_hash = BASE64.encode(signature.to_bytes());

        let export = sqlx::query_as::<_, ReputationExport>(
            r#"INSERT INTO reputation_exports
                   (persona_id, export_version, deal_count, avg_deal_cents,
                    completion_rate_pct, on_time_rate_pct, trust_scores_snapshot,
                    testimonial_count, signed_hash)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING id, persona_id, export_version, deal_count, avg_deal_cents,
                         completion_rate_pct::float8 AS completion_rate_pct,
                         on_time_rate_pct::float8 AS on_time_rate_pct,
                         trust_scores_snapshot, testimonial_count, signed_hash, created_at"#,
        )
        .bind(persona_id).bind(new_version).bind(deal_count as i32).bind(avg_deal_cents)
        .bind(completion_rate).bind(on_time_rate).bind(&trust_scores)
        .bind(testimonial_count as i32).bind(&signed_hash)
        .fetch_one(&mut *tx).await?;

        tx.commit().await?;
        info!(persona_id, version = new_version, "Reputation passport generated");
        Ok(export)
    }

    pub async fn verify(&self, persona_id: i64, version: i32) -> Result<VerificationResult, ReputationError> {
        let export = with_timeout(
            sqlx::query_as::<_, ReputationExport>(
                r#"SELECT id, persona_id, export_version, deal_count, avg_deal_cents,
                          completion_rate_pct::float8 AS completion_rate_pct,
                          on_time_rate_pct::float8 AS on_time_rate_pct,
                          trust_scores_snapshot, testimonial_count, signed_hash, created_at
                   FROM reputation_exports WHERE persona_id = $1 AND export_version = $2"#,
            )
            .bind(persona_id).bind(version)
            .fetch_optional(&self.read_pool)
        ).await?.ok_or(ReputationError::NotFound)?;

        let payload = ReputationPayload {
            persona_id: export.persona_id,
            export_version: export.export_version,
            deal_count: export.deal_count,
            avg_deal_cents: export.avg_deal_cents,
            completion_rate_pct: export.completion_rate_pct,
            on_time_rate_pct: export.on_time_rate_pct,
            trust_scores: export.trust_scores_snapshot.clone(),
            testimonial_count: export.testimonial_count,
            generated_at: export.created_at,
        };

        let payload_bytes = serde_json::to_vec(&payload)
            .map_err(|_| ReputationError::SigningKeyMissing)?;

        let sig_bytes = BASE64.decode(&export.signed_hash)
            .map_err(|_| ReputationError::InvalidSignature)?;

        let signature = Signature::from_bytes(
            sig_bytes.as_slice().try_into().map_err(|_| ReputationError::InvalidSignature)?
        );

        let valid = self.verifying_key.verify(&payload_bytes, &signature).is_ok();

        Ok(VerificationResult {
            valid,
            export: Some(export),
            public_key: self.public_key_b64(),
        })
    }

    pub async fn list_exports(&self, user_id: i64, query: &ExportListQuery) -> Result<(Vec<ReputationExport>, i64), ReputationError> {
        let limit = query.limit.unwrap_or(20).min(100) as i64;
        let offset = query.offset.unwrap_or(0).max(0) as i64;

        #[derive(sqlx::FromRow)]
        struct ExportWithCount {
            id: i64,
            persona_id: i64,
            export_version: i32,
            deal_count: i32,
            avg_deal_cents: i64,
            completion_rate_pct: f64,
            on_time_rate_pct: f64,
            trust_scores_snapshot: serde_json::Value,
            testimonial_count: i32,
            signed_hash: String,
            created_at: chrono::DateTime<chrono::Utc>,
            total_count: i64,
        }

        let rows = with_timeout(
            sqlx::query_as::<_, ExportWithCount>(
                r#"SELECT re.id, re.persona_id, re.export_version, re.deal_count, re.avg_deal_cents,
                          re.completion_rate_pct::float8 AS completion_rate_pct,
                          re.on_time_rate_pct::float8 AS on_time_rate_pct,
                          re.trust_scores_snapshot, re.testimonial_count, re.signed_hash, re.created_at,
                          COUNT(*) OVER()::int8 AS total_count
                   FROM reputation_exports re
                   JOIN personas p ON re.persona_id = p.id
                   WHERE re.persona_id = $1 AND p.owner_user_id = $2
                   ORDER BY re.export_version DESC LIMIT $3 OFFSET $4"#,
            )
            .bind(query.persona_id).bind(user_id).bind(limit).bind(offset)
            .fetch_all(&self.read_pool)
        ).await?;

        let total_count = rows.first().map(|r| r.total_count).unwrap_or(0);
        let exports = rows.into_iter().map(|r| ReputationExport {
            id: r.id,
            persona_id: r.persona_id,
            export_version: r.export_version,
            deal_count: r.deal_count,
            avg_deal_cents: r.avg_deal_cents,
            completion_rate_pct: r.completion_rate_pct,
            on_time_rate_pct: r.on_time_rate_pct,
            trust_scores_snapshot: r.trust_scores_snapshot,
            testimonial_count: r.testimonial_count,
            signed_hash: r.signed_hash,
            created_at: r.created_at,
        }).collect();

        Ok((exports, total_count))
    }
}
