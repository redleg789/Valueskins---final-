//! Event Service Layer

use chrono::Utc;
use sqlx::PgPool;
use crate::models::*;

#[derive(Debug)]
pub enum ServiceError {
    NotFound,
    Forbidden,
    RequiresValueSkin,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for ServiceError {
    fn from(e: sqlx::Error) -> Self {
        ServiceError::Database(e)
    }
}

pub struct EventService {
    pool: PgPool,
}

impl EventService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // ── Create Event (Gated) ───────────────────────────────────────────

    pub async fn create_event(
        &self,
        user_id: i64,
        req: CreateEventRequest,
    ) -> Result<i64, ServiceError> {
        // Hosting inside events is intentionally ungated by ValueSkin ownership.
        let _role: String = sqlx::query_scalar(
            "SELECT role FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        let event_id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO events
                (
                    host_user_id, event_type, category, title, description, location,
                    latitude, longitude, start_time, end_time, ticket_price_cents,
                    community_id, public_expires_at
                )
            VALUES ($1, 'general', 'general', $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    COALESCE($8, $7) + INTERVAL '7 days')
            RETURNING id
            "#
        )
        .bind(user_id)
        .bind(&req.title)
        .bind(&req.description)
        .bind(&req.location)
        .bind(req.latitude)
        .bind(req.longitude)
        .bind(req.start_time)
        .bind(req.end_time)
        .bind(req.ticket_price_cents)
        .bind(req.community_id)
        .fetch_one(&self.pool)
        .await?;

        // Host automatically attends, but ValueSkin has no special meaning here.
        sqlx::query(
            "INSERT INTO event_attendees (event_id, user_id, status) VALUES ($1, $2, 'going') ON CONFLICT DO NOTHING"
        )
        .bind(event_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(event_id)
    }

    // ── Get Event Details ──────────────────────────────────────────────

    pub async fn get_event(
        &self,
        event_id: i64,
        viewer_user_id: i64,
    ) -> Result<EventResponse, ServiceError> {
        let event = sqlx::query_as::<_, Event>(
            "SELECT * FROM events WHERE id = $1"
        )
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        self.enrich_event(event, viewer_user_id).await
    }

    // ── Register / Attend Event ────────────────────────────────────────

    pub async fn register_event(
        &self,
        event_id: i64,
        user_id: i64,
        status: String,
    ) -> Result<(), ServiceError> {
        // Validate status value
        if !["going", "interested", "saved"].contains(&status.as_str()) {
            return Err(ServiceError::Forbidden);
        }

        // Verify event exists
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM events WHERE id = $1)"
        )
        .bind(event_id)
        .fetch_one(&self.pool)
        .await?;

        if !exists {
            return Err(ServiceError::NotFound);
        }

        // Register attendance
        sqlx::query(
            r#"
            INSERT INTO event_attendees (event_id, user_id, status)
            VALUES ($1, $2, $3)
            ON CONFLICT (event_id, user_id)
            DO UPDATE SET status = EXCLUDED.status, registered_at = NOW()
            "#
        )
        .bind(event_id)
        .bind(user_id)
        .bind(status)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn unregister_event(
        &self,
        event_id: i64,
        user_id: i64,
    ) -> Result<(), ServiceError> {
        sqlx::query(
            "DELETE FROM event_attendees WHERE event_id = $1 AND user_id = $2"
        )
        .bind(event_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn record_interaction(
        &self,
        event_id: i64,
        user_id: i64,
        req: RecordEventInteractionRequest,
    ) -> Result<(), ServiceError> {
        let valid_interaction = [
            "view", "share", "search_click", "profile_click", "ticket_click",
            "purchase_started", "purchase_completed", "invite_opened",
            "invite_accepted", "save", "unsave", "recommendation_impression",
            "recommendation_click", "attend", "dropoff",
        ].contains(&req.interaction_type.as_str());

        if !valid_interaction {
            return Err(ServiceError::Forbidden);
        }

        if let Some(ref source_type) = req.source_type {
            let valid_source = [
                "search", "community", "profile", "invite", "feed", "recommendation", "direct", "unknown",
            ].contains(&source_type.as_str());
            if !valid_source {
                return Err(ServiceError::Forbidden);
            }
        }

        let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM events WHERE id = $1)")
            .bind(event_id)
            .fetch_one(&self.pool)
            .await?;
        if !exists {
            return Err(ServiceError::NotFound);
        }

        sqlx::query(
            r#"
            INSERT INTO event_interaction_events
                (
                    event_id, actor_user_id, session_id, interaction_type, source_type,
                    referrer_event_id, referrer_user_id, source_metadata, time_spent_seconds
                )
            VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, '{}'::jsonb), $9)
            "#
        )
        .bind(event_id)
        .bind(user_id)
        .bind(req.session_id)
        .bind(req.interaction_type)
        .bind(req.source_type.unwrap_or_else(|| "unknown".to_string()))
        .bind(req.referrer_event_id)
        .bind(req.referrer_user_id)
        .bind(req.source_metadata)
        .bind(req.time_spent_seconds)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn search_valueskins(
        &self,
        query: String,
        limit: i64,
        _cursor: Option<String>,
    ) -> Result<(Vec<ValueSkinSearchResult>, Option<String>), ServiceError> {
        let search_term = query.trim();
        if search_term.len() < 2 {
            return Ok((Vec::new(), None));
        }

        let rows: Vec<(i64, i64, String, String, Option<String>, i64, Option<String>, Vec<String>, i64, bool)> = sqlx::query_as(
            r#"
            WITH persona_skins AS (
                SELECT
                    p.id AS persona_id,
                    p.owner_user_id AS user_id,
                    COALESCE(p.display_name, u.username) AS display_name,
                    u.username,
                    p.avatar_uri,
                    COALESCE(u.followers_count, 0) AS followers_count,
                    ARRAY_REMOVE(ARRAY_AGG(DISTINCT prof.name), NULL) AS professions,
                    COALESCE(MIN(prof.name) FILTER (WHERE pp.slot = 'primary'), MIN(prof.name)) AS primary_profession,
                    COUNT(pp.persona_id) > 0 AS has_skins
                FROM personas p
                JOIN users u ON u.id = p.owner_user_id
                LEFT JOIN persona_professions pp ON pp.persona_id = p.id
                LEFT JOIN professions prof ON prof.id = pp.profession_id
                WHERE p.exists = TRUE
                  AND u.is_active = TRUE
                GROUP BY p.id, p.owner_user_id, p.display_name, u.username, p.avatar_uri, u.followers_count
            )
            SELECT
                persona_id,
                user_id,
                display_name,
                username,
                avatar_uri,
                followers_count,
                primary_profession,
                COALESCE(professions, '{}'::text[]),
                CASE
                    WHEN LOWER(display_name) = LOWER($1) THEN 0
                    WHEN LOWER(username) = LOWER($1) THEN 1
                    WHEN display_name ILIKE $2 THEN 2
                    WHEN username ILIKE $2 THEN 3
                    ELSE 4
                END AS rank_bucket,
                EXISTS (
                    SELECT 1
                    FROM creator_leaderboard cl
                    WHERE cl.user_id = user_id AND cl.reputation_score >= 50
                ) AS verified
            FROM persona_skins
            WHERE display_name ILIKE $2
               OR username ILIKE $2
               OR EXISTS (
                    SELECT 1
                    FROM unnest(professions) prof_name
                    WHERE prof_name ILIKE $2
               )
            ORDER BY rank_bucket, followers_count DESC, persona_id DESC
            LIMIT $3
            "#,
        )
        .bind(search_term)
        .bind(format!("%{}%", search_term))
        .bind(limit + 1)
        .fetch_all(&self.pool)
        .await?;

        let mut results = Vec::new();
        for (persona_id, user_id, display_name, username, avatar_uri, followers_count, primary_profession, professions, _rank_bucket, verified) in rows.into_iter().take(limit as usize) {
            let cursor_value = format!("{}|{}", Utc::now().to_rfc3339(), persona_id);
            results.push(ValueSkinSearchResult {
                persona_id,
                user_id,
                name: display_name,
                handle: format!("@{}", username),
                avatar_url: avatar_uri,
                verified,
                followers_count,
                descriptor: primary_profession.clone().unwrap_or_else(|| professions.first().cloned().unwrap_or_else(|| "ValueSkin profile".to_string())),
                professions,
                primary_profession,
                can_be_tagged: true,
                cursor: cursor_value,
            });
        }

        let next_cursor = if results.len() as i64 >= limit {
            results.last().map(|row| row.cursor.clone())
        } else {
            None
        };

        Ok((results, next_cursor))
    }

    pub async fn get_event_tags(
        &self,
        event_id: i64,
        viewer_user_id: i64,
    ) -> Result<Vec<EventTagResponse>, ServiceError> {
        let event = sqlx::query_as::<_, Event>(
            "SELECT * FROM events WHERE id = $1"
        )
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        let is_host = event.host_user_id == viewer_user_id;
        let rows: Vec<EventFeaturedPersonRow> = sqlx::query_as(
            r#"
            SELECT *
            FROM event_featured_people
            WHERE event_id = $1
              AND deleted_at IS NULL
              AND (
                  $2 = TRUE
                  OR approval_state = 'approved'
                  OR tagged_user_id = $3
              )
            ORDER BY sort_order ASC, created_at ASC
            "#
        )
        .bind(event_id)
        .bind(is_host)
        .bind(viewer_user_id)
        .fetch_all(&self.pool)
        .await?;

        let mut tags = Vec::new();
        for row in rows {
            let profile: Option<(String, String, Option<String>)> = sqlx::query_as(
                r#"
                SELECT COALESCE(p.display_name, u.username), u.username, p.avatar_uri
                FROM personas p
                JOIN users u ON u.id = p.owner_user_id
                WHERE p.id = $1 AND p.exists = TRUE AND u.is_active = TRUE
                "#
            )
            .bind(row.tagged_persona_id)
            .fetch_optional(&self.pool)
            .await?;

            let Some((name, username, avatar_url)) = profile else {
                continue;
            };

            tags.push(EventTagResponse {
                id: row.id,
                event_id: row.event_id,
                tagged_user_id: row.tagged_user_id,
                tagged_persona_id: row.tagged_persona_id,
                tagged_by_user_id: row.tagged_by_user_id,
                tag_type: row.tag_type,
                badge_label: row.badge_label,
                display_role: row.display_role,
                descriptor: row.descriptor,
                approval_state: row.approval_state,
                is_public: row.is_public,
                auto_approve: row.auto_approve,
                hidden_by_tagged_user: row.hidden_by_tagged_user,
                approved_at: row.approved_at,
                rejected_at: row.rejected_at,
                created_at: row.created_at,
                name,
                handle: format!("@{}", username),
                avatar_url,
            });
        }

        Ok(tags)
    }

    pub async fn add_event_tag(
        &self,
        event_id: i64,
        host_user_id: i64,
        req: CreateEventTagRequest,
    ) -> Result<EventTagResponse, ServiceError> {
        let event = sqlx::query_as::<_, Event>(
            "SELECT * FROM events WHERE id = $1"
        )
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        if event.host_user_id != host_user_id {
            return Err(ServiceError::Forbidden);
        }

        let persona_profile: Option<(i64, i64, String, String, Option<String>)> = sqlx::query_as(
            r#"
            SELECT p.id, p.owner_user_id, COALESCE(p.display_name, u.username), u.username, p.avatar_uri
            FROM personas p
            JOIN users u ON u.id = p.owner_user_id
            WHERE p.id = $1 AND p.exists = TRUE AND u.is_active = TRUE
            "#
        )
        .bind(req.tagged_persona_id)
        .fetch_optional(&self.pool)
        .await?;

        let (tagged_persona_id, tagged_user_id, tagged_name, tagged_username, _avatar) =
            persona_profile.ok_or(ServiceError::NotFound)?;

        let attendee_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM event_attendees WHERE event_id = $1 AND user_id = $2)"
        )
        .bind(event_id)
        .bind(tagged_user_id)
        .fetch_one(&self.pool)
        .await?;
        if attendee_exists || tagged_user_id == event.host_user_id {
            return Err(ServiceError::Forbidden);
        }

        let preference: Option<(bool, bool, Vec<i64>)> = sqlx::query_as(
            "SELECT auto_approve, notify_on_tag, trusted_host_allowlist FROM event_tag_preferences WHERE tagged_user_id = $1"
        )
        .bind(tagged_user_id)
        .fetch_optional(&self.pool)
        .await?;

        let trusted_host = preference
            .as_ref()
            .map(|(_, _, allowlist)| allowlist.contains(&event.host_user_id))
            .unwrap_or(false);
        let auto_approve = req.auto_approve.unwrap_or(false)
            || preference.as_ref().map(|(auto, _, _)| *auto).unwrap_or(false)
            || trusted_host;

        let approval_state = if auto_approve { "approved" } else { "pending" };
        let is_public = auto_approve;
        let badge_label = req.badge_label.unwrap_or_else(|| req.tag_type.clone());
        let display_role = req.display_role.unwrap_or_else(|| req.tag_type.clone());

        let tag: EventFeaturedPersonRow = sqlx::query_as(
            r#"
            INSERT INTO event_featured_people (
                event_id, tagged_user_id, tagged_persona_id, tagged_by_user_id,
                tag_type, badge_label, display_role, descriptor, approval_state,
                is_public, auto_approve, approved_by_user_id, approved_at, sort_order, tag_metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $10 THEN $4 ELSE NULL END,
                    CASE WHEN $10 THEN NOW() ELSE NULL END, COALESCE($12, 0), COALESCE($13, '{}'::jsonb))
            RETURNING *
            "#
        )
        .bind(event_id)
        .bind(tagged_user_id)
        .bind(tagged_persona_id)
        .bind(host_user_id)
        .bind(&req.tag_type)
        .bind(&badge_label)
        .bind(&display_role)
        .bind(&req.descriptor)
        .bind(approval_state)
        .bind(is_public)
        .bind(auto_approve)
        .bind(req.sort_order.unwrap_or(0))
        .bind(serde_json::json!({
            "tagged_name": tagged_name,
            "tagged_username": tagged_username,
        }))
        .fetch_one(&self.pool)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO event_tag_audit_logs (event_tag_id, event_id, actor_user_id, action, reason, metadata)
            VALUES ($1, $2, $3, 'created', $4, $5)
            "#
        )
        .bind(tag.id)
        .bind(event_id)
        .bind(host_user_id)
        .bind(req.descriptor.clone())
        .bind(serde_json::json!({
            "tag_type": req.tag_type,
            "badge_label": badge_label,
        }))
        .execute(&self.pool)
        .await?;

        let notify_payload = serde_json::json!({
            "event_id": event_id,
            "event_tag_id": tag.id,
            "host_user_id": host_user_id,
            "tagged_user_id": tagged_user_id,
            "approval_state": approval_state,
        });

        let (notify_on_tag,): (bool,) = sqlx::query_as(
            "SELECT COALESCE(notify_on_tag, TRUE) FROM event_tag_preferences WHERE tagged_user_id = $1"
        )
        .bind(tagged_user_id)
        .fetch_optional(&self.pool)
        .await?
        .unwrap_or((true,));

        if notify_on_tag {
            let notification_message = if auto_approve {
                format!("You were featured in {} and it is already public.", event.title)
            } else {
                format!("You were tagged in {}. Approve or reject the appearance.", event.title)
            };
            sqlx::query(
                r#"
                INSERT INTO notification_queue
                    (recipient_user_id, channel, event_type, message, metadata, scheduled_at)
                VALUES ($1, 'in_app', $2, $3, $4, NOW())
                "#
            )
            .bind(tagged_user_id)
            .bind(if auto_approve { "event_tag_approved" } else { "event_tag_request" })
            .bind(notification_message)
            .bind(notify_payload)
            .execute(&self.pool)
            .await?;
        }

        self.get_event_tag(tag.id, host_user_id).await
    }

    pub async fn decision_on_event_tag(
        &self,
        event_id: i64,
        tag_id: i64,
        actor_user_id: i64,
        approve: bool,
        reason: Option<String>,
    ) -> Result<EventTagResponse, ServiceError> {
        let event = sqlx::query_as::<_, Event>(
            "SELECT * FROM events WHERE id = $1"
        )
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        let tag = sqlx::query_as::<_, EventFeaturedPersonRow>(
            "SELECT * FROM event_featured_people WHERE id = $1 AND event_id = $2 AND deleted_at IS NULL"
        )
        .bind(tag_id)
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        if tag.tagged_user_id != actor_user_id {
            return Err(ServiceError::Forbidden);
        }

        let (approval_state, approved_at, rejected_at, is_public, action) = if approve {
            ("approved", Some(Utc::now()), None, true, "approved")
        } else {
            ("rejected", None, Some(Utc::now()), false, "rejected")
        };

        let updated: EventFeaturedPersonRow = sqlx::query_as(
            r#"
            UPDATE event_featured_people
            SET approval_state = $3,
                approved_at = COALESCE($4, approved_at),
                rejected_at = COALESCE($5, rejected_at),
                is_public = $6,
                updated_at = NOW()
            WHERE id = $1 AND event_id = $2 AND deleted_at IS NULL
            RETURNING *
            "#
        )
        .bind(tag_id)
        .bind(event_id)
        .bind(approval_state)
        .bind(approved_at)
        .bind(rejected_at)
        .bind(is_public)
        .fetch_one(&self.pool)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO event_tag_audit_logs (event_tag_id, event_id, actor_user_id, action, reason, metadata)
            VALUES ($1, $2, $3, $4, $5, '{}'::jsonb)
            "#
        )
        .bind(tag_id)
        .bind(event_id)
        .bind(actor_user_id)
        .bind(action)
        .bind(reason)
        .execute(&self.pool)
        .await?;

        let notification_message = if approve {
            format!("Your featured appearance in {} was approved.", event.title)
        } else {
            format!("Your featured appearance in {} was rejected.", event.title)
        };
        sqlx::query(
            r#"
            INSERT INTO notification_queue
                (recipient_user_id, channel, event_type, message, metadata, scheduled_at)
            VALUES ($1, 'in_app', $2, $3, $4, NOW())
            "#
        )
        .bind(event.host_user_id)
        .bind(if approve { "event_tag_approved" } else { "event_tag_rejected" })
        .bind(notification_message)
        .bind(serde_json::json!({
            "event_id": event_id,
            "event_tag_id": tag_id,
            "actor_user_id": actor_user_id,
            "tagged_user_id": tag.tagged_user_id,
        }))
        .execute(&self.pool)
        .await?;

        self.get_event_tag(updated.id, actor_user_id).await
    }

    pub async fn remove_event_tag(
        &self,
        event_id: i64,
        tag_id: i64,
        actor_user_id: i64,
    ) -> Result<(), ServiceError> {
        let event = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1")
            .bind(event_id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(ServiceError::NotFound)?;

        let tag = sqlx::query_as::<_, EventFeaturedPersonRow>(
            "SELECT * FROM event_featured_people WHERE id = $1 AND event_id = $2 AND deleted_at IS NULL"
        )
        .bind(tag_id)
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        let is_host = event.host_user_id == actor_user_id;
        let is_tagged_user = tag.tagged_user_id == actor_user_id;
        if !is_host && !is_tagged_user {
            return Err(ServiceError::Forbidden);
        }

        let (approval_state, hidden_by_tagged_user, hidden_at, removed_at, deleted_at, action) = if is_tagged_user && !is_host {
            ("hidden", true, Some(Utc::now()), tag.removed_at, Some(Utc::now()), "hidden")
        } else {
            ("removed", tag.hidden_by_tagged_user, tag.hidden_at, Some(Utc::now()), Some(Utc::now()), "removed")
        };

        sqlx::query(
            r#"
            UPDATE event_featured_people
            SET approval_state = $3,
                hidden_by_tagged_user = $4,
                hidden_at = $5,
                removed_at = $6,
                deleted_at = $7,
                is_public = FALSE,
                updated_at = NOW()
            WHERE id = $1 AND event_id = $2
            "#
        )
        .bind(tag_id)
        .bind(event_id)
        .bind(approval_state)
        .bind(hidden_by_tagged_user)
        .bind(hidden_at)
        .bind(removed_at)
        .bind(deleted_at)
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO event_tag_audit_logs (event_tag_id, event_id, actor_user_id, action, reason, metadata)
            VALUES ($1, $2, $3, $4, NULL, '{}'::jsonb)
            "#
        )
        .bind(tag_id)
        .bind(event_id)
        .bind(actor_user_id)
        .bind(action)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // ── Update Preferred City ──────────────────────────────────────────

    pub async fn update_preferred_city(
        &self,
        user_id: i64,
        city: String,
    ) -> Result<(), ServiceError> {
        sqlx::query(
            r#"
            INSERT INTO user_settings (user_id, preferred_city)
            VALUES ($1, $2)
            ON CONFLICT (user_id)
            DO UPDATE SET preferred_city = EXCLUDED.preferred_city, updated_at = NOW()
            "#
        )
        .bind(user_id)
        .bind(city)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // ── Explorer Home Page Content ──────────────────────────────────────

    pub async fn get_explorer_home(
        &self,
        user_id: i64,
    ) -> Result<ExplorerHomeResponse, ServiceError> {
        // Fetch preferred city from user_settings
        let preferred_city: String = sqlx::query_scalar(
            "SELECT preferred_city FROM user_settings WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .unwrap_or_default();

        // 1. Upcoming Events (General upcoming public/joined community events)
        let upcoming_rows = sqlx::query_as::<_, Event>(
            r#"
            SELECT e.* FROM events e
            WHERE e.start_time >= NOW()
              AND e.discovery_visible = TRUE
            ORDER BY e.start_time ASC
            LIMIT 10
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let mut upcoming_events = Vec::new();
        for row in upcoming_rows {
            upcoming_events.push(self.enrich_event(row, user_id).await?);
        }

        // 2. Recommended Events
        // Personalized on preferred_city, joined communities or popular ones
        let recommended_rows = if !preferred_city.is_empty() {
            sqlx::query_as::<_, Event>(
                r#"
                SELECT e.* FROM events e
                WHERE e.start_time >= NOW()
                AND e.recommendation_visible = TRUE
                AND (LOWER(e.location) LIKE LOWER($1) OR e.community_id IN (
                    SELECT community_id FROM community_members WHERE user_id = $2
                ))
                ORDER BY e.attendee_count DESC, e.start_time ASC
                LIMIT 10
                "#
            )
            .bind(format!("%{}%", preferred_city))
            .bind(user_id)
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, Event>(
                r#"
                SELECT e.* FROM events e
                WHERE e.start_time >= NOW()
                AND e.recommendation_visible = TRUE
                ORDER BY e.attendee_count DESC, e.start_time ASC
                LIMIT 10
                "#
            )
            .fetch_all(&self.pool)
            .await?
        };

        let mut recommended_events = Vec::new();
        for row in recommended_rows {
            recommended_events.push(self.enrich_event(row, user_id).await?);
        }

        // 3. Featured Communities
        let communities = sqlx::query_as::<_, CommunityPreview>(
            r#"
            SELECT id, name, description, member_count, avatar_color, avatar_abbr
            FROM communities
            ORDER BY member_count DESC
            LIMIT 5
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        // 4. People Attending Upcoming Events (Previews of active creators)
        let people_rows = sqlx::query_as::<_, (i64, String, Option<String>)>(
            r#"
            SELECT DISTINCT u.id, COALESCE(u.display_name, 'Anonymous'), u.role
            FROM users u
            JOIN event_attendees ea ON ea.user_id = u.id
            JOIN events e ON e.id = ea.event_id
            WHERE e.start_time >= NOW() AND e.discovery_visible = TRUE AND u.role = 'creator'
            LIMIT 8
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let mut people_attending = Vec::new();
        for (uid, name, _role) in people_rows {
            // Fetch primary profession name as role title
            let role_title: Option<String> = sqlx::query_scalar(
                "SELECT profession FROM user_valueskin_tiers WHERE user_id = $1 LIMIT 1"
            )
            .bind(uid)
            .fetch_optional(&self.pool)
            .await?;

            people_attending.push(AttendeePreview {
                user_id: uid,
                display_name: name,
                avatar_color: "#7C3AED".to_string(), // Default violet
                role_title,
            });
        }

        // 5. Personalized Calendar (All events user has registered/saved)
        let calendar_rows = sqlx::query_as::<_, Event>(
            r#"
            SELECT e.* FROM events e
            JOIN event_attendees ea ON ea.event_id = e.id
            WHERE ea.user_id = $1
              AND e.feed_visible = TRUE
              AND e.start_time >= NOW() - INTERVAL '1 day'
            ORDER BY e.start_time ASC
            "#
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        let mut calendar = Vec::new();
        for row in calendar_rows {
            calendar.push(self.enrich_event(row, user_id).await?);
        }

        Ok(ExplorerHomeResponse {
            upcoming_events,
            recommended_events,
            featured_communities: communities,
            people_attending,
            calendar,
        })
    }

    // ── Helper to Enrich Event Details ─────────────────────────────────

    async fn enrich_event(&self, event: Event, viewer_user_id: i64) -> Result<EventResponse, ServiceError> {
        // Fetch host details
        let host_data: Option<(String, String)> = sqlx::query_as(
            "SELECT COALESCE(display_name, 'Host'), role FROM users WHERE id = $1"
        )
        .bind(event.host_user_id)
        .fetch_optional(&self.pool)
        .await?;

        let (host_name, host_role) = host_data.unwrap_or_else(|| ("Host".to_string(), "creator".to_string()));

        // Fetch viewer's status
        let status: Option<String> = sqlx::query_scalar(
            "SELECT status FROM event_attendees WHERE event_id = $1 AND user_id = $2"
        )
        .bind(event.id)
        .bind(viewer_user_id)
        .fetch_optional(&self.pool)
        .await?;

        // Fetch a few attendee previews
        let mut friends_attending = Vec::new();
        if event.attendee_list_public {
            let attendee_rows = sqlx::query_as::<_, (i64, String)>(
                r#"
                SELECT u.id, COALESCE(u.display_name, 'User')
                FROM users u
                JOIN event_attendees ea ON ea.user_id = u.id
                WHERE ea.event_id = $1 AND ea.status = 'going'
                LIMIT 5
                "#
            )
            .bind(event.id)
            .fetch_all(&self.pool)
            .await?;

            for (uid, name) in attendee_rows {
                let role_title: Option<String> = sqlx::query_scalar(
                    "SELECT profession FROM user_valueskin_tiers WHERE user_id = $1 LIMIT 1"
                )
                .bind(uid)
                .fetch_optional(&self.pool)
                .await?;

                friends_attending.push(AttendeePreview {
                    user_id: uid,
                    display_name: name,
                    avatar_color: "#2563EB".to_string(), // default blue
                    role_title,
                });
            }
        }

        // Fetch mutual interests (professions/domains) associated with the event community if exists
        let mut mutual_interests = Vec::new();
        let mut community_name = None;

        if let Some(comm_id) = event.community_id {
            let name_val: Option<String> = sqlx::query_scalar(
                "SELECT name FROM communities WHERE id = $1"
            )
            .bind(comm_id)
            .fetch_optional(&self.pool)
            .await?;
            community_name = name_val;

            let gates: Vec<String> = sqlx::query_scalar(
                "SELECT profession FROM community_gates WHERE community_id = $1"
            )
            .bind(comm_id)
            .fetch_all(&self.pool)
            .await?;
            mutual_interests = gates;
        }

        let featured_people = self.get_event_tags(event.id, viewer_user_id).await.unwrap_or_default()
            .into_iter()
            .filter(|tag| tag.approval_state == "approved" || tag.tagged_user_id == viewer_user_id || event.host_user_id == viewer_user_id)
            .map(|tag| EventFeaturedPersonResponse {
                id: tag.id,
                tagged_user_id: tag.tagged_user_id,
                tagged_persona_id: tag.tagged_persona_id,
                name: tag.name,
                handle: tag.handle,
                avatar_url: tag.avatar_url,
                tag_type: tag.tag_type,
                badge_label: tag.badge_label,
                display_role: tag.display_role,
                descriptor: tag.descriptor,
                approval_state: tag.approval_state,
                is_public: tag.is_public,
                auto_approve: tag.auto_approve,
                hidden_by_tagged_user: tag.hidden_by_tagged_user,
                approved_at: tag.approved_at,
                created_at: tag.created_at,
            })
            .collect();

        let public_status_message = match event.visibility_status.as_str() {
            "archived" => "Archived event".to_string(),
            "ended_visible" => "This event has ended.".to_string(),
            _ => "Live event".to_string(),
        };

        Ok(EventResponse {
            id: event.id,
            host_id: event.host_user_id,
            host_name,
            host_role,
            title: event.title,
            description: event.description,
            location: event.location,
            start_time: event.start_time,
            end_time: event.end_time,
            ticket_price_cents: event.ticket_price_cents,
            attendee_count: event.attendee_count,
            status,
            friends_attending,
            mutual_interests,
            community_name,
            lifecycle_state: event.visibility_status,
            public_status_message,
            attendee_list_public: event.attendee_list_public,
            is_publicly_listed: event.is_publicly_listed,
            event_type: event.event_type,
            category: event.category,
            featured_people,
        })
    }

    async fn get_event_tag(&self, tag_id: i64, viewer_user_id: i64) -> Result<EventTagResponse, ServiceError> {
        let row = sqlx::query_as::<_, EventFeaturedPersonRow>(
            "SELECT * FROM event_featured_people WHERE id = $1 AND deleted_at IS NULL"
        )
        .bind(tag_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        let profile: Option<(String, String, Option<String>)> = sqlx::query_as(
            r#"
            SELECT COALESCE(p.display_name, u.username), u.username, p.avatar_uri
            FROM personas p
            JOIN users u ON u.id = p.owner_user_id
            WHERE p.id = $1 AND p.exists = TRUE AND u.is_active = TRUE
            "#
        )
        .bind(row.tagged_persona_id)
        .fetch_optional(&self.pool)
        .await?;

        let Some((name, username, avatar_url)) = profile else {
            return Err(ServiceError::NotFound);
        };

        Ok(EventTagResponse {
            id: row.id,
            event_id: row.event_id,
            tagged_user_id: row.tagged_user_id,
            tagged_persona_id: row.tagged_persona_id,
            tagged_by_user_id: row.tagged_by_user_id,
            tag_type: row.tag_type,
            badge_label: row.badge_label,
            display_role: row.display_role,
            descriptor: row.descriptor,
            approval_state: row.approval_state,
            is_public: row.is_public,
            auto_approve: row.auto_approve,
            hidden_by_tagged_user: row.hidden_by_tagged_user,
            approved_at: row.approved_at,
            rejected_at: row.rejected_at,
            created_at: row.created_at,
            name,
            handle: format!("@{}", username),
            avatar_url,
        })
    }
}
