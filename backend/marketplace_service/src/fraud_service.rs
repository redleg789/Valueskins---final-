use chrono::Utc;
use sqlx::PgPool;

#[derive(Clone, Debug)]
pub struct FraudSignal {
    pub id: i64,
    pub creator_user_id: i64,
    pub signal_type: String,
    pub severity: String,
    pub details: serde_json::Value,
    pub detected_at: chrono::DateTime<chrono::Utc>,
    pub resolved_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Clone, Debug)]
pub enum FraudError {
    NotFound,
    Database(String),
}

impl From<sqlx::Error> for FraudError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => FraudError::NotFound,
            _ => FraudError::Database(err.to_string()),
        }
    }
}

pub struct FraudService {
    pool: PgPool,
}

impl FraudService {
    pub fn new(pool: PgPool) -> Self {
        FraudService { pool }
    }

    /// Detect self-dealing: creator's user_id == brand_user_id in completed deals
    async fn detect_self_dealing(
        &self,
        creator_user_id: i64,
    ) -> Result<Option<FraudSignal>, FraudError> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM completed_deals
             WHERE creator_user_id = $1 AND brand_user_id = $1"
        )
        .bind(creator_user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(FraudError::from)?;

        if count > 0 {
            let now = Utc::now();
            let signal_id = sqlx::query_scalar::<_, i64>(
                "INSERT INTO reputation_fraud_signals
                 (creator_user_id, signal_type, severity, details, detected_at)
                 VALUES ($1, 'self_dealing', 'high', $2, $3)
                 ON CONFLICT DO NOTHING
                 RETURNING id"
            )
            .bind(creator_user_id)
            .bind(serde_json::json!({"deals_found": count}))
            .bind(now)
            .fetch_optional(&self.pool)
            .await
            .map_err(FraudError::from)?;

            if let Some(id) = signal_id {
                return Ok(Some(FraudSignal {
                    id,
                    creator_user_id,
                    signal_type: "self_dealing".to_string(),
                    severity: "high".to_string(),
                    details: serde_json::json!({"deals_found": count}),
                    detected_at: now,
                    resolved_at: None,
                }));
            }
        }
        Ok(None)
    }

    /// Detect velocity spike: >10 deals in any rolling 7-day window
    async fn detect_velocity_spike(
        &self,
        creator_user_id: i64,
    ) -> Result<Option<FraudSignal>, FraudError> {
        // Self-join: for each deal, count how many other deals happened within 7 days
        let max_in_window: Option<i64> = sqlx::query_scalar(
            r#"
            SELECT MAX(window_count) FROM (
                SELECT COUNT(*) as window_count
                FROM completed_deals a
                JOIN completed_deals b ON b.creator_user_id = a.creator_user_id
                  AND b.completed_at BETWEEN a.completed_at - INTERVAL '7 days' AND a.completed_at
                WHERE a.creator_user_id = $1
                GROUP BY a.id
                HAVING COUNT(*) > 10
            ) sub
            "#
        )
        .bind(creator_user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(FraudError::from)?
        .flatten();

        if let Some(deals_in_window) = max_in_window {
            let now = Utc::now();
            let signal_id = sqlx::query_scalar::<_, i64>(
                "INSERT INTO reputation_fraud_signals
                 (creator_user_id, signal_type, severity, details, detected_at)
                 VALUES ($1, 'velocity_spike', 'medium', $2, $3)
                 ON CONFLICT DO NOTHING
                 RETURNING id"
            )
            .bind(creator_user_id)
            .bind(serde_json::json!({"deals_in_7days": deals_in_window}))
            .bind(now)
            .fetch_optional(&self.pool)
            .await
            .map_err(FraudError::from)?;

            if let Some(id) = signal_id {
                return Ok(Some(FraudSignal {
                    id,
                    creator_user_id,
                    signal_type: "velocity_spike".to_string(),
                    severity: "medium".to_string(),
                    details: serde_json::json!({"deals_in_7days": deals_in_window}),
                    detected_at: now,
                    resolved_at: None,
                }));
            }
        }
        Ok(None)
    }

    /// Detect rating collusion: >80% ratings from same brand AND count >= 5
    async fn detect_rating_collusion(
        &self,
        creator_user_id: i64,
    ) -> Result<Option<FraudSignal>, FraudError> {
        let collusion_data: Option<(i64, i64)> = sqlx::query_as(
            "SELECT brand_user_id, COUNT(*) as rating_count
             FROM completed_deals
             WHERE creator_user_id = $1
             GROUP BY brand_user_id
             HAVING COUNT(*) >= 5
             AND CAST(COUNT(*) AS FLOAT) / (
                SELECT COUNT(*) FROM completed_deals WHERE creator_user_id = $1
             ) > 0.80
             LIMIT 1"
        )
        .bind(creator_user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(FraudError::from)?;

        if let Some((brand_id, rating_count)) = collusion_data {
            let now = Utc::now();
            let signal_id = sqlx::query_scalar::<_, i64>(
                "INSERT INTO reputation_fraud_signals
                 (creator_user_id, signal_type, severity, details, detected_at)
                 VALUES ($1, 'rating_collusion', 'high', $2, $3)
                 ON CONFLICT DO NOTHING
                 RETURNING id"
            )
            .bind(creator_user_id)
            .bind(serde_json::json!({"brand_user_id": brand_id, "rating_count": rating_count}))
            .bind(now)
            .fetch_optional(&self.pool)
            .await
            .map_err(FraudError::from)?;

            if let Some(id) = signal_id {
                return Ok(Some(FraudSignal {
                    id,
                    creator_user_id,
                    signal_type: "rating_collusion".to_string(),
                    severity: "high".to_string(),
                    details: serde_json::json!({"brand_user_id": brand_id, "rating_count": rating_count}),
                    detected_at: now,
                    resolved_at: None,
                }));
            }
        }
        Ok(None)
    }

    /// Run full fraud scan (all 3 detectors) for a creator
    pub async fn run_full_scan(
        &self,
        creator_user_id: i64,
    ) -> Result<Vec<FraudSignal>, FraudError> {
        let mut signals = Vec::new();

        if let Ok(Some(sig)) = self.detect_self_dealing(creator_user_id).await {
            signals.push(sig);
        }
        if let Ok(Some(sig)) = self.detect_velocity_spike(creator_user_id).await {
            signals.push(sig);
        }
        if let Ok(Some(sig)) = self.detect_rating_collusion(creator_user_id).await {
            signals.push(sig);
        }

        Ok(signals)
    }

    /// Batch scan all creators — paginated to prevent OOM at scale.
    pub async fn batch_scan_all(&self) -> Result<usize, FraudError> {
        let batch_size: i64 = 1000;
        let mut offset: i64 = 0;
        let mut count = 0;

        loop {
            let creator_ids: Vec<i64> = sqlx::query_scalar(
                "SELECT DISTINCT creator_user_id FROM completed_deals \
                 ORDER BY creator_user_id LIMIT $1 OFFSET $2"
            )
            .bind(batch_size)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(FraudError::from)?;

            if creator_ids.is_empty() {
                break;
            }

            for creator_id in &creator_ids {
                if let Ok(signals) = self.run_full_scan(*creator_id).await {
                    count += signals.len();
                }
            }

            offset += batch_size;
        }

        Ok(count)
    }

    /// Resolve a fraud signal
    pub async fn resolve_signal(
        &self,
        signal_id: i64,
        resolver_user_id: i64,
        notes: String,
    ) -> Result<(), FraudError> {
        let now = Utc::now();
        sqlx::query(
            "UPDATE reputation_fraud_signals
             SET resolved_at = $1, resolved_by_user_id = $2, resolver_notes = $3
             WHERE id = $4"
        )
        .bind(now)
        .bind(resolver_user_id)
        .bind(notes)
        .bind(signal_id)
        .execute(&self.pool)
        .await
        .map_err(FraudError::from)?;

        Ok(())
    }

    /// List unresolved signals for a creator
    pub async fn list_unresolved(
        &self,
        creator_user_id: i64,
    ) -> Result<Vec<FraudSignal>, FraudError> {
        let rows: Vec<(i64, i64, String, String, serde_json::Value, chrono::DateTime<chrono::Utc>, Option<chrono::DateTime<chrono::Utc>>)> = sqlx::query_as(
            "SELECT id, creator_user_id, signal_type, severity, details, detected_at, resolved_at
             FROM reputation_fraud_signals
             WHERE creator_user_id = $1 AND resolved_at IS NULL
             ORDER BY detected_at DESC"
        )
        .bind(creator_user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(FraudError::from)?;

        Ok(rows.into_iter().map(|r| FraudSignal {
            id: r.0,
            creator_user_id: r.1,
            signal_type: r.2,
            severity: r.3,
            details: r.4,
            detected_at: r.5,
            resolved_at: r.6,
        }).collect())
    }
}
