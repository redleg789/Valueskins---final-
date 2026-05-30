use chrono::Utc;
use sqlx::PgPool;

#[derive(Clone, Debug)]
pub struct EscrowDispute {
    pub id: i64,
    pub deal_room_id: i64,
    pub escrow_stage_id: i64,
    pub raised_by_user_id: i64,
    pub against_user_id: i64,
    pub reason: String,
    pub evidence_urls: Vec<String>,
    pub status: String,
    pub resolution_notes: Option<String>,
    pub resolved_by_user_id: Option<i64>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub resolved_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Clone, Debug)]
pub enum DisputeError {
    NotFound,
    NotMember,
    Forbidden,
    Database(String),
}

impl From<sqlx::Error> for DisputeError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => DisputeError::NotFound,
            _ => DisputeError::Database(err.to_string()),
        }
    }
}

pub struct DisputeService {
    pool: PgPool,
}

impl DisputeService {
    pub fn new(pool: PgPool) -> Self {
        DisputeService { pool }
    }

    /// Raise a dispute on an escrow stage
    /// Validates that raised_by_user_id is either brand_user_id or creator of the deal room
    pub async fn raise_dispute(
        &self,
        deal_room_id: i64,
        escrow_stage_id: i64,
        raised_by_user_id: i64,
        against_user_id: i64,
        reason: String,
        evidence_urls: Vec<String>,
    ) -> Result<i64, DisputeError> {
        // Verify escrow_stage belongs to deal_room
        let stage_deal_id: i64 = sqlx::query_scalar(
            "SELECT deal_room_id FROM escrow_stages WHERE id = $1"
        )
        .bind(escrow_stage_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(DisputeError::from)?
        .ok_or(DisputeError::NotFound)?;

        if stage_deal_id != deal_room_id {
            return Err(DisputeError::NotFound);
        }

        // Verify raised_by is member of deal room (brand or creator)
        let (brand_id, creator_persona_id): (i64, i64) = sqlx::query_as(
            "SELECT brand_user_id, creator_persona_id FROM deal_rooms WHERE id = $1"
        )
        .bind(deal_room_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(DisputeError::from)?
        .ok_or(DisputeError::NotFound)?;

        let creator_user_id: i64 = sqlx::query_scalar(
            "SELECT user_id FROM personas WHERE id = $1"
        )
        .bind(creator_persona_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(DisputeError::from)?
        .ok_or(DisputeError::NotFound)?;

        let is_member = raised_by_user_id == brand_id || raised_by_user_id == creator_user_id;
        if !is_member {
            return Err(DisputeError::Forbidden);
        }

        // INSERT dispute
        let now = Utc::now();
        let dispute_id: i64 = sqlx::query_scalar(
            "INSERT INTO escrow_disputes
             (deal_room_id, escrow_stage_id, raised_by_user_id, against_user_id, reason, evidence_urls, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)
             RETURNING id"
        )
        .bind(deal_room_id)
        .bind(escrow_stage_id)
        .bind(raised_by_user_id)
        .bind(against_user_id)
        .bind(reason)
        .bind(evidence_urls.as_slice())
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(DisputeError::from)?;

        Ok(dispute_id)
    }

    /// Valid dispute statuses for filtering
    const VALID_STATUSES: &'static [&'static str] = &[
        "open", "under_review", "resolved_creator", "resolved_brand", "resolved_split", "dismissed",
    ];

    /// List disputes (admin sees all, others see only their own)
    pub async fn list_disputes(
        &self,
        viewer_user_id: i64,
        filter_status: Option<String>,
        limit: i32,
        offset: i32,
    ) -> Result<Vec<EscrowDispute>, DisputeError> {
        // Validate filter_status against whitelist
        if let Some(ref s) = filter_status {
            if !Self::VALID_STATUSES.contains(&s.as_str()) {
                return Err(DisputeError::Database(format!("Invalid status filter: {}", s)));
            }
        }

        let is_admin: bool = sqlx::query_scalar(
            "SELECT COALESCE(role = 'admin', FALSE) FROM users WHERE id = $1"
        )
        .bind(viewer_user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(DisputeError::from)?
        .flatten()
        .unwrap_or(false);

        let max_limit = (limit.min(100).max(1)) as i64;
        let safe_offset = (offset.max(0)) as i64;

        let rows: Vec<(
            i64, i64, i64, i64, i64, String, Vec<String>, String, Option<String>, Option<i64>,
            chrono::DateTime<chrono::Utc>, Option<chrono::DateTime<chrono::Utc>>
        )> = sqlx::query_as(
            r#"
            SELECT id, deal_room_id, escrow_stage_id, raised_by_user_id, against_user_id,
                   reason, evidence_urls, status, resolution_notes, resolved_by_user_id, created_at, resolved_at
            FROM escrow_disputes
            WHERE ($1::bool = TRUE OR raised_by_user_id = $2 OR against_user_id = $2)
              AND ($3::text IS NULL OR status = $3)
            ORDER BY created_at DESC
            LIMIT $4 OFFSET $5
            "#
        )
        .bind(is_admin)
        .bind(viewer_user_id)
        .bind(&filter_status)
        .bind(max_limit)
        .bind(safe_offset)
        .fetch_all(&self.pool)
        .await
        .map_err(DisputeError::from)?;

        Ok(rows.into_iter().map(|r| EscrowDispute {
            id: r.0,
            deal_room_id: r.1,
            escrow_stage_id: r.2,
            raised_by_user_id: r.3,
            against_user_id: r.4,
            reason: r.5,
            evidence_urls: r.6,
            status: r.7,
            resolution_notes: r.8,
            resolved_by_user_id: r.9,
            created_at: r.10,
            resolved_at: r.11,
        }).collect())
    }

    /// Resolve a dispute (admin only)
    pub async fn resolve_dispute(
        &self,
        dispute_id: i64,
        resolver_user_id: i64,
        resolution: String,
        notes: String,
    ) -> Result<(), DisputeError> {
        // Verify resolver is admin
        let is_admin: bool = sqlx::query_scalar(
            "SELECT COALESCE(role = 'admin', FALSE) FROM users WHERE id = $1"
        )
        .bind(resolver_user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(DisputeError::from)?
        .flatten()
        .unwrap_or(false);

        if !is_admin {
            return Err(DisputeError::Forbidden);
        }

        // Validate resolution value
        let valid_resolutions = ["resolved_creator", "resolved_brand", "resolved_split", "dismissed"];
        if !valid_resolutions.contains(&resolution.as_str()) {
            return Err(DisputeError::Database(format!("Invalid resolution: {}", resolution)));
        }

        let stage_status = match resolution.as_str() {
            "resolved_creator" | "resolved_brand" | "resolved_split" => "completed",
            _ => "pending",
        };

        let now = Utc::now();
        let mut tx = self.pool.begin().await.map_err(DisputeError::from)?;

        sqlx::query(
            "UPDATE escrow_disputes
             SET status = $1, resolution_notes = $2, resolved_by_user_id = $3, resolved_at = $4
             WHERE id = $5"
        )
        .bind(&resolution)
        .bind(notes)
        .bind(resolver_user_id)
        .bind(now)
        .bind(dispute_id)
        .execute(&mut *tx)
        .await
        .map_err(DisputeError::from)?;

        let stage_id: i64 = sqlx::query_scalar(
            "SELECT escrow_stage_id FROM escrow_disputes WHERE id = $1"
        )
        .bind(dispute_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(DisputeError::from)?;

        sqlx::query(
            "UPDATE escrow_stages SET status = $1, updated_at = $2 WHERE id = $3"
        )
        .bind(stage_status)
        .bind(now)
        .bind(stage_id)
        .execute(&mut *tx)
        .await
        .map_err(DisputeError::from)?;

        tx.commit().await.map_err(DisputeError::from)?;

        Ok(())
    }

    /// Get a dispute by ID
    pub async fn get_dispute(&self, dispute_id: i64) -> Result<EscrowDispute, DisputeError> {
        let row: (
            i64, i64, i64, i64, i64, String, Vec<String>, String, Option<String>, Option<i64>,
            chrono::DateTime<chrono::Utc>, Option<chrono::DateTime<chrono::Utc>>
        ) = sqlx::query_as(
            "SELECT id, deal_room_id, escrow_stage_id, raised_by_user_id, against_user_id,
                    reason, evidence_urls, status, resolution_notes, resolved_by_user_id, created_at, resolved_at
             FROM escrow_disputes WHERE id = $1"
        )
        .bind(dispute_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(DisputeError::from)?
        .ok_or(DisputeError::NotFound)?;

        Ok(EscrowDispute {
            id: row.0,
            deal_room_id: row.1,
            escrow_stage_id: row.2,
            raised_by_user_id: row.3,
            against_user_id: row.4,
            reason: row.5,
            evidence_urls: row.6,
            status: row.7,
            resolution_notes: row.8,
            resolved_by_user_id: row.9,
            created_at: row.10,
            resolved_at: row.11,
        })
    }
}
