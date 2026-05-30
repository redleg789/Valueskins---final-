use crate::models::*;
use sqlx::PgPool;
use chrono::Utc;

pub struct ModerationService {
    pool: PgPool,
}

impl ModerationService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // ============================================================
    // Report Creation
    // ============================================================

    /// User reports another user. Creates a moderation_queue entry
    /// with source=USER_REPORT. Prevents self-report, duplicate open reports,
    /// and reporting moderators.
    pub async fn create_report(
        &self,
        reporter_id: i64,
        req: &CreateReportRequest,
    ) -> Result<ModerationQueueItem, ModerationError> {
        if reporter_id == req.target_user_id {
            return Err(ModerationError::CannotReportSelf);
        }

        let target_role: Option<String> = sqlx::query_scalar(
            "SELECT role FROM users WHERE id = $1"
        )
        .bind(req.target_user_id)
        .fetch_optional(&self.pool)
        .await?
        .flatten();

        match target_role {
            None => return Err(ModerationError::UserNotFound),
            Some(ref r) if r == "moderator" || r == "admin" => {
                return Err(ModerationError::TargetIsModerator);
            }
            _ => {}
        }

        let existing: Option<i64> = sqlx::query_scalar(
            "SELECT id FROM moderation_queue
             WHERE target_user_id = $1
               AND status IN ('open', 'in_progress')
               AND source = 'USER_REPORT'
             LIMIT 1"
        )
        .bind(req.target_user_id)
        .fetch_optional(&self.pool)
        .await?;

        if existing.is_some() {
            return Err(ModerationError::DuplicateReport);
        }

        let item: ModerationQueueItem = sqlx::query_as(
            "INSERT INTO moderation_queue
             (target_user_id, source, priority, category, description, status)
             VALUES ($1, 'USER_REPORT', 'normal', $2, $3, 'open')
             RETURNING id, target_user_id, target_company_id, target_contract_id,
                       source, priority, category, description,
                       assigned_moderator_user_id, moderator_action, moderator_notes,
                       action_taken_at, requires_escalation, escalated_to_user_id,
                       escalated_at, escalation_reason, is_appealable, appeal_deadline,
                       status, created_at, updated_at"
        )
        .bind(req.target_user_id)
        .bind(&req.category)
        .bind(&req.description)
        .fetch_one(&self.pool)
        .await?;

        sqlx::query(
            "INSERT INTO report_creators (queue_item_id, reporter_user_id) VALUES ($1, $2)"
        )
        .bind(item.id)
        .bind(reporter_id)
        .execute(&self.pool)
        .await?;

        Ok(item)
    }

    // ============================================================
    // Queue Management
    // ============================================================

    pub async fn get_queue(
        &self,
        params: &QueueQueryParams,
    ) -> Result<Vec<ModerationQueueItem>, ModerationError> {
        let limit = params.limit.unwrap_or(50).min(200);
        let offset = params.offset.unwrap_or(0);

        let mut sql = String::from(
            "SELECT id, target_user_id, target_company_id, target_contract_id,
                    source, priority, category, description,
                    assigned_moderator_user_id, moderator_action, moderator_notes,
                    action_taken_at, requires_escalation, escalated_to_user_id,
                    escalated_at, escalation_reason, is_appealable, appeal_deadline,
                    status, created_at, updated_at
             FROM moderation_queue WHERE 1=1"
        );

        let mut idx = 1;

        if let Some(ref status) = params.status {
            sql.push_str(&format!(" AND status = ${}", idx));
            idx += 1;
        }
        if let Some(ref source) = params.source {
            sql.push_str(&format!(" AND source = ${}", idx));
            idx += 1;
        }
        if let Some(ref category) = params.category {
            sql.push_str(&format!(" AND category = ${}", idx));
            idx += 1;
        }
        if let Some(ref priority) = params.priority {
            sql.push_str(&format!(" AND priority = ${}", idx));
            idx += 1;
        }
        if let Some(assigned) = params.assigned_to {
            sql.push_str(&format!(" AND assigned_moderator_user_id = ${}", idx));
            idx += 1;
            let _ = assigned;
        }

        sql.push_str(" ORDER BY
            CASE priority
                WHEN 'critical' THEN 0
                WHEN 'high' THEN 1
                WHEN 'normal' THEN 2
                WHEN 'low' THEN 3
                ELSE 4
            END,
            created_at ASC");
        sql.push_str(&format!(" LIMIT ${} OFFSET ${}", idx, idx + 1));

        let mut query = sqlx::query_as::<_, ModerationQueueItem>(&sql);

        if let Some(ref status) = params.status {
            query = query.bind(status);
        }
        if let Some(ref source) = params.source {
            query = query.bind(source);
        }
        if let Some(ref category) = params.category {
            query = query.bind(category);
        }
        if let Some(ref priority) = params.priority {
            query = query.bind(priority);
        }
        if let Some(assigned) = params.assigned_to {
            query = query.bind(assigned);
        }

        query = query.bind(limit as i64).bind(offset as i64);

        let items = query.fetch_all(&self.pool).await?;
        Ok(items)
    }

    pub async fn get_queue_item(
        &self,
        item_id: i64,
    ) -> Result<ModerationQueueItem, ModerationError> {
        let item = sqlx::query_as(
            "SELECT id, target_user_id, target_company_id, target_contract_id,
                    source, priority, category, description,
                    assigned_moderator_user_id, moderator_action, moderator_notes,
                    action_taken_at, requires_escalation, escalated_to_user_id,
                    escalated_at, escalation_reason, is_appealable, appeal_deadline,
                    status, created_at, updated_at
             FROM moderation_queue WHERE id = $1"
        )
        .bind(item_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(item)
    }

    pub async fn get_queue_stats(
        &self,
    ) -> Result<QueueStatsResponse, ModerationError> {
        let counts: Vec<(String, i64)> = sqlx::query_as(
            "SELECT status, COUNT(*) as cnt FROM moderation_queue GROUP BY status"
        )
        .fetch_all(&self.pool)
        .await?;

        let by_cat: Vec<(String, i64)> = sqlx::query_as(
            "SELECT category, COUNT(*) as cnt FROM moderation_queue WHERE status IN ('open', 'in_progress') GROUP BY category"
        )
        .fetch_all(&self.pool)
        .await?;

        let by_pri: Vec<(String, i64)> = sqlx::query_as(
            "SELECT priority, COUNT(*) as cnt FROM moderation_queue WHERE status IN ('open', 'in_progress') GROUP BY priority"
        )
        .fetch_all(&self.pool)
        .await?;

        let oldest: Option<chrono::DateTime<Utc>> = sqlx::query_scalar(
            "SELECT MIN(created_at) FROM moderation_queue WHERE status IN ('open', 'in_progress')"
        )
        .fetch_optional(&self.pool)
        .await?;

        let mut stats = QueueStatsResponse {
            open: 0,
            in_progress: 0,
            resolved: 0,
            escalated: 0,
            total: 0,
            by_category: serde_json::json!({}),
            by_priority: serde_json::json!({}),
            oldest_item_minutes: None,
        };

        for (status, count) in counts {
            stats.total += count;
            match status.as_str() {
                "open" => stats.open = count,
                "in_progress" => stats.in_progress = count,
                "resolved" => stats.resolved = count,
                "escalated" => stats.escalated = count,
                _ => {}
            }
        }

        let cat_map: serde_json::Value = by_cat.iter()
            .map(|(k, v)| (k.clone(), serde_json::json!(v)))
            .collect();
        stats.by_category = cat_map;

        let pri_map: serde_json::Value = by_pri.iter()
            .map(|(k, v)| (k.clone(), serde_json::json!(v)))
            .collect();
        stats.by_priority = pri_map;

        if let Some(old) = oldest {
            let minutes = (Utc::now() - old).num_minutes();
            stats.oldest_item_minutes = Some(minutes);
        }

        Ok(stats)
    }

    // ============================================================
    // Moderator Actions
    // ============================================================

    /// Assign a moderator to a queue item.
    pub async fn assign_moderator(
        &self,
        item_id: i64,
        moderator_id: i64,
        actor_id: i64,
        actor_ip: Option<String>,
    ) -> Result<ModerationQueueItem, ModerationError> {
        let item = self.get_queue_item(item_id).await?;

        if item.status == "resolved" {
            return Err(ModerationError::AlreadyResolved);
        }

        let updated: ModerationQueueItem = sqlx::query_as(
            "UPDATE moderation_queue
             SET assigned_moderator_user_id = $1,
                 status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING id, target_user_id, target_company_id, target_contract_id,
                       source, priority, category, description,
                       assigned_moderator_user_id, moderator_action, moderator_notes,
                       action_taken_at, requires_escalation, escalated_to_user_id,
                       escalated_at, escalation_reason, is_appealable, appeal_deadline,
                       status, created_at, updated_at"
        )
        .bind(moderator_id)
        .bind(item_id)
        .fetch_one(&self.pool)
        .await?;

        self.log_audit(
            actor_id, "assigned", "moderation_queue", item_id,
            Some(&item.status), Some(&updated.status),
            &format!("Assigned to moderator {}", moderator_id),
            actor_ip,
        ).await;

        Ok(updated)
    }

    /// Take moderation action (warning, suspension, ban, etc.).
    pub async fn take_action(
        &self,
        item_id: i64,
        moderator_id: i64,
        req: &TakeActionRequest,
        actor_ip: Option<String>,
    ) -> Result<ModerationActionTakenResponse, ModerationError> {
        let item = self.get_queue_item(item_id).await?;

        if item.status == "resolved" || item.status == "escalated" {
            return Err(ModerationError::AlreadyResolved);
        }

        let valid_actions = [
            "NONE", "WARNING", "CONTENT_REMOVED", "TEMPORARY_SUSPENSION",
            "PERMANENT_SUSPENSION", "ACCOUNT_FREEZE", "FEATURE_RESTRICTION",
            "TRUST_SCORE_DECREASE", "BADGE_REMOVAL", "VERIFICATION_REVOCATION",
            "LEGAL_ESCALATION",
        ];
        if !valid_actions.contains(&req.action.as_str()) {
            return Err(ModerationError::InvalidAction(req.action.clone()));
        }

        let mut user_suspended = false;
        let mut user_banned = false;

        match req.action.as_str() {
            "TEMPORARY_SUSPENSION" | "ACCOUNT_FREEZE" => {
                if let Some(target_id) = item.target_user_id {
                    sqlx::query(
                        "UPDATE users SET user_state = 'SUSPENDED', updated_at = NOW() WHERE id = $1"
                    )
                    .bind(target_id)
                    .execute(&self.pool)
                    .await?;

                    sqlx::query(
                        "UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL"
                    )
                    .bind(target_id)
                    .execute(&self.pool)
                    .await?;

                    if let Some(hours) = req.silence_duration_hours {
                        sqlx::query(
                            "INSERT INTO user_restrictions (user_id, restriction_type, reason, queue_item_id, expires_at, created_by_user_id)
                             VALUES ($1, 'SUSPENDED', $2, $3, NOW() + $4 * INTERVAL '1 hour', $5)"
                        )
                        .bind(target_id)
                        .bind(&req.notes)
                        .bind(item_id)
                        .bind(hours)
                        .bind(moderator_id)
                        .execute(&self.pool)
                        .await?;
                    }

                    user_suspended = true;
                }
            }
            "PERMANENT_SUSPENSION" => {
                if let Some(target_id) = item.target_user_id {
                    sqlx::query(
                        "UPDATE users SET user_state = 'PERMANENTLY_BANNED', updated_at = NOW() WHERE id = $1"
                    )
                    .bind(target_id)
                    .execute(&self.pool)
                    .await?;

                    sqlx::query(
                        "UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL"
                    )
                    .bind(target_id)
                    .execute(&self.pool)
                    .await?;

                    user_banned = true;
                }
            }
            "FEATURE_RESTRICTION" => {
                if let Some(target_id) = item.target_user_id {
                    if let Some(ref rtype) = req.restriction_type {
                        let expires = req.restriction_expires_hours
                            .map(|h| Utc::now() + chrono::Duration::hours(h));
                        sqlx::query(
                            "INSERT INTO user_restrictions (user_id, restriction_type, reason, queue_item_id, expires_at, created_by_user_id)
                             VALUES ($1, $2, $3, $4, $5, $6)"
                        )
                        .bind(target_id)
                        .bind(rtype)
                        .bind(&req.notes)
                        .bind(item_id)
                        .bind(expires)
                        .bind(moderator_id)
                        .execute(&self.pool)
                        .await?;
                    }
                }
            }
            "WARNING" => {}
            _ => {}
        }

        let appealable = req.is_appealable.unwrap_or(true);
        let deadline = if appealable {
            Some(Utc::now() + chrono::Duration::days(30))
        } else {
            None
        };

        let updated: ModerationQueueItem = sqlx::query_as(
            "UPDATE moderation_queue
             SET status = 'resolved',
                 moderator_action = $1,
                 moderator_notes = $2,
                 action_taken_at = NOW(),
                 assigned_moderator_user_id = COALESCE(assigned_moderator_user_id, $3),
                 is_appealable = $4,
                 appeal_deadline = $5,
                 updated_at = NOW()
             WHERE id = $6
             RETURNING id, target_user_id, target_company_id, target_contract_id,
                       source, priority, category, description,
                       assigned_moderator_user_id, moderator_action, moderator_notes,
                       action_taken_at, requires_escalation, escalated_to_user_id,
                       escalated_at, escalation_reason, is_appealable, appeal_deadline,
                       status, created_at, updated_at"
        )
        .bind(&req.action)
        .bind(&req.notes)
        .bind(moderator_id)
        .bind(appealable)
        .bind(deadline)
        .bind(item_id)
        .fetch_one(&self.pool)
        .await?;

        self.log_audit(
            moderator_id, "action_taken", "moderation_queue", item_id,
            Some("in_progress"), Some("resolved"),
            &format!("Action: {}. Notes: {}", req.action, req.notes),
            actor_ip,
        ).await;

        Ok(ModerationActionTakenResponse {
            queue_item_id: item_id,
            action: req.action.clone(),
            user_suspended,
            user_banned,
            sessions_revoked: user_suspended || user_banned,
            appeal_available: appealable,
            appeal_deadline: deadline,
        })
    }

    /// Add notes without taking action (for investigation).
    pub async fn add_notes(
        &self,
        item_id: i64,
        moderator_id: i64,
        notes: &str,
        actor_ip: Option<String>,
    ) -> Result<ModerationQueueItem, ModerationError> {
        let item = self.get_queue_item(item_id).await?;

        let updated: ModerationQueueItem = sqlx::query_as(
            "UPDATE moderation_queue
             SET moderator_notes = CASE
                     WHEN moderator_notes IS NULL THEN $1
                     ELSE moderator_notes || E'\n---\n' || $1
                 END,
                 assigned_moderator_user_id = COALESCE(assigned_moderator_user_id, $2),
                 updated_at = NOW()
             WHERE id = $3
             RETURNING id, target_user_id, target_company_id, target_contract_id,
                       source, priority, category, description,
                       assigned_moderator_user_id, moderator_action, moderator_notes,
                       action_taken_at, requires_escalation, escalated_to_user_id,
                       escalated_at, escalation_reason, is_appealable, appeal_deadline,
                       status, created_at, updated_at"
        )
        .bind(notes)
        .bind(moderator_id)
        .bind(item_id)
        .fetch_one(&self.pool)
        .await?;

        self.log_audit(
            moderator_id, "notes_added", "moderation_queue", item_id,
            None, None,
            &format!("Note added: {}", notes),
            actor_ip,
        ).await;

        Ok(updated)
    }

    /// Escalate to senior moderator or legal.
    pub async fn escalate(
        &self,
        item_id: i64,
        moderator_id: i64,
        req: &EscalateRequest,
        actor_ip: Option<String>,
    ) -> Result<ModerationQueueItem, ModerationError> {
        let item = self.get_queue_item(item_id).await?;

        if item.requires_escalation && item.escalated_to_user_id.is_some() {
            return Err(ModerationError::AlreadyAtHighestLevel);
        }

        let updated: ModerationQueueItem = sqlx::query_as(
            "UPDATE moderation_queue
             SET status = 'escalated',
                 requires_escalation = TRUE,
                 escalated_to_user_id = $1,
                 escalated_at = NOW(),
                 escalation_reason = $2,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING id, target_user_id, target_company_id, target_contract_id,
                       source, priority, category, description,
                       assigned_moderator_user_id, moderator_action, moderator_notes,
                       action_taken_at, requires_escalation, escalated_to_user_id,
                       escalated_at, escalation_reason, is_appealable, appeal_deadline,
                       status, created_at, updated_at"
        )
        .bind(req.escalated_to_user_id)
        .bind(&req.reason)
        .bind(item_id)
        .fetch_one(&self.pool)
        .await?;

        self.log_audit(
            moderator_id, "escalated", "moderation_queue", item_id,
            Some(&item.status), Some("escalated"),
            &format!("Escalated to {}. Reason: {}", req.escalated_to_user_id, req.reason),
            actor_ip,
        ).await;

        Ok(updated)
    }

    // ============================================================
    // Appeals
    // ============================================================

    /// User files an appeal against a moderation action.
    pub async fn file_appeal(
        &self,
        queue_item_id: i64,
        appellant_user_id: i64,
        req: &FileAppealRequest,
    ) -> Result<Appeal, ModerationError> {
        let item = self.get_queue_item(queue_item_id).await?;

        if !item.is_appealable {
            return Err(ModerationError::InvalidStateTransition(
                "This action is not appealable".into()
            ));
        }

        if let Some(deadline) = item.appeal_deadline {
            if Utc::now() > deadline {
                return Err(ModerationError::InvalidStateTransition(
                    "Appeal deadline has passed".into()
                ));
            }
        }

        let existing: Option<i64> = sqlx::query_scalar(
            "SELECT id FROM appeals WHERE queue_item_id = $1 AND appellant_user_id = $2 AND status = 'pending'"
        )
        .bind(queue_item_id)
        .bind(appellant_user_id)
        .fetch_optional(&self.pool)
        .await?;

        if existing.is_some() {
            return Err(ModerationError::InvalidStateTransition(
                "Appeal already pending".into()
            ));
        }

        sqlx::query(
            "UPDATE moderation_queue SET status = 'appealed', updated_at = NOW() WHERE id = $1"
        )
        .bind(queue_item_id)
        .execute(&self.pool)
        .await?;

        let appeal: Appeal = sqlx::query_as(
            "INSERT INTO appeals (queue_item_id, appellant_user_id, reason, supporting_evidence, status)
             VALUES ($1, $2, $3, $4, 'pending')
             RETURNING id, queue_item_id, appellant_user_id, reason, supporting_evidence,
                       status, reviewed_by_user_id, reviewer_notes, resolution,
                       created_at, updated_at"
        )
        .bind(queue_item_id)
        .bind(appellant_user_id)
        .bind(&req.reason)
        .bind(&req.supporting_evidence)
        .fetch_one(&self.pool)
        .await?;

        Ok(appeal)
    }

    /// Moderator reviews and resolves an appeal.
    pub async fn review_appeal(
        &self,
        appeal_id: i64,
        moderator_id: i64,
        req: &ReviewAppealRequest,
        actor_ip: Option<String>,
    ) -> Result<Appeal, ModerationError> {
        let appeal: Appeal = sqlx::query_as(
            "SELECT id, queue_item_id, appellant_user_id, reason, supporting_evidence,
                    status, reviewed_by_user_id, reviewer_notes, resolution,
                    created_at, updated_at
             FROM appeals WHERE id = $1"
        )
        .bind(appeal_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ModerationError::AppealNotFound)?;

        if appeal.status != "pending" {
            return Err(ModerationError::AppealAlreadyResolved);
        }

        let valid = ["UPHELD", "OVERTURNED", "PARTIALLY_UPHELD"];
        if !valid.contains(&req.resolution.as_str()) {
            return Err(ModerationError::InvalidAction(req.resolution.clone()));
        }

        let updated: Appeal = sqlx::query_as(
            "UPDATE appeals
             SET status = 'resolved',
                 resolution = $1,
                 reviewer_notes = $2,
                 reviewed_by_user_id = $3,
                 updated_at = NOW()
             WHERE id = $4
             RETURNING id, queue_item_id, appellant_user_id, reason, supporting_evidence,
                       status, reviewed_by_user_id, reviewer_notes, resolution,
                       created_at, updated_at"
        )
        .bind(&req.resolution)
        .bind(&req.reviewer_notes)
        .bind(moderator_id)
        .bind(appeal_id)
        .fetch_one(&self.pool)
        .await?;

        if req.resolution == "OVERTURNED" || req.resolution == "PARTIALLY_UPHELD" {
            if let Some(target_id) = self.get_target_user_for_appeal(appeal.queue_item_id).await? {
                sqlx::query(
                    "UPDATE users SET user_state = 'ACTIVE', updated_at = NOW() WHERE id = $1 AND user_state IN ('SUSPENDED', 'PERMANENTLY_BANNED')"
                )
                .bind(target_id)
                .execute(&self.pool)
                .await?;

                sqlx::query(
                    "UPDATE moderation_queue SET moderator_action = CASE WHEN $1 = 'OVERTURNED' THEN 'APPEAL_OVERTURNED' ELSE moderator_action END, status = 'resolved', updated_at = NOW() WHERE id = $2"
                )
                .bind(&req.resolution)
                .bind(appeal.queue_item_id)
                .execute(&self.pool)
                .await?;
            }
        }

        self.log_audit(
            moderator_id, "appeal_reviewed", "appeals", appeal_id,
            Some("pending"), Some("resolved"),
            &format!("Appeal resolution: {}. Notes: {}", req.resolution, req.reviewer_notes.as_deref().unwrap_or("none")),
            actor_ip,
        ).await;

        Ok(updated)
    }

    async fn get_target_user_for_appeal(
        &self,
        queue_item_id: i64,
    ) -> Result<Option<i64>, ModerationError> {
        let target: Option<i64> = sqlx::query_scalar(
            "SELECT target_user_id FROM moderation_queue WHERE id = $1"
        )
        .bind(queue_item_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(target)
    }

    // ============================================================
    // Audit Log
    // ============================================================

    pub async fn get_audit_log(
        &self,
        params: &AuditQueryParams,
    ) -> Result<Vec<ModeratorAuditEntry>, ModerationError> {
        let limit = params.limit.unwrap_or(50).min(200);
        let offset = params.offset.unwrap_or(0);

        let mut sql = String::from(
            "SELECT id, moderator_user_id, action_type, target_type, target_id,
                    previous_state, new_state, action_description, ip_address, created_at
             FROM moderator_audit_log WHERE 1=1"
        );

        let mut idx = 1;

        if let Some(mod_id) = params.moderator_user_id {
            sql.push_str(&format!(" AND moderator_user_id = ${}", idx));
            idx += 1;
            let _ = mod_id;
        }
        if let Some(ref at) = params.action_type {
            sql.push_str(&format!(" AND action_type = ${}", idx));
            idx += 1;
            let _ = at;
        }
        if let Some(ref tt) = params.target_type {
            sql.push_str(&format!(" AND target_type = ${}", idx));
            idx += 1;
            let _ = tt;
        }
        if let Some(tid) = params.target_id {
            sql.push_str(&format!(" AND target_id = ${}", idx));
            idx += 1;
            let _ = tid;
        }

        sql.push_str(" ORDER BY created_at DESC");
        sql.push_str(&format!(" LIMIT ${} OFFSET ${}", idx, idx + 1));

        let mut query = sqlx::query_as::<_, ModeratorAuditEntry>(&sql);

        if let Some(mod_id) = params.moderator_user_id {
            query = query.bind(mod_id);
        }
        if let Some(ref at) = params.action_type {
            query = query.bind(at);
        }
        if let Some(ref tt) = params.target_type {
            query = query.bind(tt);
        }
        if let Some(tid) = params.target_id {
            query = query.bind(tid);
        }

        query = query.bind(limit as i64).bind(offset as i64);
        let entries = query.fetch_all(&self.pool).await?;
        Ok(entries)
    }

    async fn log_audit(
        &self,
        moderator_id: i64,
        action_type: &str,
        target_type: &str,
        target_id: i64,
        previous_state: Option<&str>,
        new_state: Option<&str>,
        description: &str,
        ip_address: Option<String>,
    ) {
        let result = sqlx::query(
            "INSERT INTO moderator_audit_log
             (moderator_user_id, action_type, target_type, target_id,
              previous_state, new_state, action_description, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
        )
        .bind(moderator_id)
        .bind(action_type)
        .bind(target_type)
        .bind(target_id)
        .bind(previous_state)
        .bind(new_state)
        .bind(description)
        .bind(ip_address)
        .execute(&self.pool)
        .await;

        if let Err(e) = result {
            tracing::error!(moderator_id, error = %e, "Failed to write moderator audit log");
        }
    }

    // ============================================================
    // User State Queries (for status endpoints)
    // ============================================================

    pub async fn get_user_restrictions(
        &self,
        user_id: i64,
    ) -> Result<Vec<UserRestriction>, ModerationError> {
        let restrictions = sqlx::query_as(
            "SELECT id, user_id, restriction_type, reason, queue_item_id,
                    expires_at, is_active, created_by_user_id, created_at
             FROM user_restrictions
             WHERE user_id = $1 AND is_active = TRUE
               AND (expires_at IS NULL OR expires_at > NOW())
             ORDER BY created_at DESC"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(restrictions)
    }

    pub async fn get_user_moderation_history(
        &self,
        user_id: i64,
    ) -> Result<Vec<ModerationQueueItem>, ModerationError> {
        let items = sqlx::query_as(
            "SELECT id, target_user_id, target_company_id, target_contract_id,
                    source, priority, category, description,
                    assigned_moderator_user_id, moderator_action, moderator_notes,
                    action_taken_at, requires_escalation, escalated_to_user_id,
                    escalated_at, escalation_reason, is_appealable, appeal_deadline,
                    status, created_at, updated_at
             FROM moderation_queue
             WHERE target_user_id = $1
             ORDER BY created_at DESC
             LIMIT 50"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(items)
    }
}
