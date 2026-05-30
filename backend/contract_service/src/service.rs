use sqlx::PgPool;
use sha2::{Sha256, Digest};
use tracing::{info, warn};
use chrono::Utc;
use std::time::Duration;
use crate::models::*;

/// Contract service — Meta-scale.
///
/// Critical fixes:
///   - SELECT FOR UPDATE on sign (TOCTOU race)
///   - Read replica for all reads
///   - Statement timeouts
///   - Atomic revision cap check + insert
///   - Advisory lock per deal_room on generation (prevents duplicate contracts)
pub struct ContractService {
    pool: PgPool,
    read_pool: PgPool,
}

#[derive(Debug)]
pub enum ContractError {
    NotFound,
    NotAuthorized,
    AlreadyExists,
    AlreadySigned,
    HashMismatch,
    RevisionCapExceeded,
    InvalidTemplate,
    InvalidStatus(String),
    Timeout,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for ContractError {
    fn from(e: sqlx::Error) -> Self {
        ContractError::Database(e)
    }
}

async fn with_timeout<T, F>(future: F) -> Result<T, ContractError>
where
    F: std::future::Future<Output = Result<T, sqlx::Error>>,
{
    match tokio::time::timeout(Duration::from_secs(5), future).await {
        Ok(result) => result.map_err(ContractError::from),
        Err(_) => Err(ContractError::Timeout),
    }
}

impl ContractService {
    pub fn new(pool: PgPool, read_pool: PgPool) -> Self {
        Self { pool, read_pool }
    }

    pub fn new_single_pool(pool: PgPool) -> Self {
        Self { read_pool: pool.clone(), pool }
    }

    fn hash_content(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Generate contract — advisory lock per deal_room prevents duplicate creation race.
    pub async fn generate(
        &self,
        user_id: i64,
        req: &GenerateContractRequest,
    ) -> Result<ContractInstance, ContractError> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT pg_advisory_xact_lock(7393, hashtext($1::text)::int)")
            .bind(req.deal_room_id.to_string())
            .execute(&mut *tx)
            .await?;

        let participant: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM deal_rooms WHERE id = $1 AND (creator_user_id = $2 OR brand_user_id = $2))",
        )
        .bind(req.deal_room_id).bind(user_id)
        .fetch_one(&mut *tx).await?;

        if !participant { return Err(ContractError::NotAuthorized); }

        let existing: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM contract_instances WHERE deal_room_id = $1)",
        )
        .bind(req.deal_room_id)
        .fetch_one(&mut *tx).await?;

        if existing { return Err(ContractError::AlreadyExists); }

        let template = sqlx::query_as::<_, ContractTemplate>(
            r#"SELECT id, template_name, template_type, description, template_body,
                      default_revision_cap, default_kill_fee_pct, default_advance_pct,
                      default_exclusivity_days, usage_rights_description, created_at, updated_at
               FROM contract_templates WHERE template_type = $1
               ORDER BY updated_at DESC LIMIT 1"#,
        )
        .bind(&req.template_type)
        .fetch_optional(&mut *tx).await?
        .ok_or(ContractError::InvalidTemplate)?;

        let deal_info: Option<(String, String, String, String)> = sqlx::query_as(
            r#"SELECT creator.display_name, brand.display_name, creator.username, brand.username
               FROM deal_rooms dr
               JOIN users creator ON dr.creator_user_id = creator.id
               JOIN users brand ON dr.brand_user_id = brand.id
               WHERE dr.id = $1"#,
        )
        .bind(req.deal_room_id)
        .fetch_optional(&mut *tx).await?;

        let (creator_name, brand_name, creator_username, brand_username) =
            deal_info.ok_or(ContractError::NotFound)?;

        let revision_cap = req.revision_cap.unwrap_or(template.default_revision_cap);
        let kill_fee_pct = req.kill_fee_pct.unwrap_or(template.default_kill_fee_pct);
        let advance_pct = req.advance_pct.unwrap_or(template.default_advance_pct);
        let exclusivity_days = req.exclusivity_days.unwrap_or(template.default_exclusivity_days);
        let currency = req.currency.as_deref().unwrap_or("USD");

        let content = template.template_body
            .replace("{{creator_name}}", &creator_name)
            .replace("{{brand_name}}", &brand_name)
            .replace("{{creator_username}}", &creator_username)
            .replace("{{brand_username}}", &brand_username)
            .replace("{{amount}}", &format!("{:.2}", req.exact_amount_cents as f64 / 100.0))
            .replace("{{currency}}", currency)
            .replace("{{deliverables}}", &req.deliverable_list)
            .replace("{{revision_cap}}", &revision_cap.to_string())
            .replace("{{kill_fee_pct}}", &kill_fee_pct.to_string())
            .replace("{{advance_pct}}", &advance_pct.to_string())
            .replace("{{exclusivity_days}}", &exclusivity_days.to_string())
            .replace("{{usage_rights}}", &req.usage_rights_scope)
            .replace("{{date}}", &Utc::now().format("%Y-%m-%d").to_string());

        let content_hash = Self::hash_content(&content);

        let instance = sqlx::query_as::<_, ContractInstance>(
            r#"INSERT INTO contract_instances
                   (deal_room_id, template_id, contract_content, contract_hash,
                    status, exact_amount_cents, currency, deliverable_list,
                    revision_cap, kill_fee_pct, advance_pct, exclusivity_days,
                    usage_rights_scope, deadline)
               VALUES ($1, $2, $3, $4, 'pending_both', $5, $6, $7, $8, $9, $10, $11, $12, $13)
               RETURNING id, deal_room_id, template_id, contract_content, contract_hash,
                         pdf_url, status, exact_amount_cents, currency, deliverable_list,
                         revision_cap, kill_fee_pct, advance_pct, exclusivity_days,
                         usage_rights_scope, deadline, brand_signed_at, brand_signed_hash,
                         creator_signed_at, creator_signed_hash, created_at, updated_at"#,
        )
        .bind(req.deal_room_id).bind(template.id).bind(&content).bind(&content_hash)
        .bind(req.exact_amount_cents).bind(currency).bind(&req.deliverable_list)
        .bind(revision_cap).bind(kill_fee_pct).bind(advance_pct).bind(exclusivity_days)
        .bind(&req.usage_rights_scope).bind(req.deadline)
        .fetch_one(&mut *tx).await?;

        tx.commit().await?;
        info!(contract_id = instance.id, deal_room_id = req.deal_room_id, hash = %content_hash, "Contract generated");
        Ok(instance)
    }

    /// Sign — FOR UPDATE prevents TOCTOU race on concurrent signatures.
    pub async fn sign(
        &self,
        user_id: i64,
        contract_id: i64,
        req: &SignContractRequest,
    ) -> Result<ContractInstance, ContractError> {
        let mut tx = self.pool.begin().await?;

        let contract: ContractInstance = sqlx::query_as(
            r#"SELECT id, deal_room_id, template_id, contract_content, contract_hash,
                      pdf_url, status, exact_amount_cents, currency, deliverable_list,
                      revision_cap, kill_fee_pct, advance_pct, exclusivity_days,
                      usage_rights_scope, deadline, brand_signed_at, brand_signed_hash,
                      creator_signed_at, creator_signed_hash, created_at, updated_at
               FROM contract_instances WHERE id = $1 FOR UPDATE"#,
        )
        .bind(contract_id)
        .fetch_optional(&mut *tx).await?
        .ok_or(ContractError::NotFound)?;

        let role: Option<String> = sqlx::query_scalar(
            r#"SELECT CASE WHEN dr.creator_user_id = $2 THEN 'creator'
                           WHEN dr.brand_user_id = $2 THEN 'brand' ELSE NULL END
               FROM deal_rooms dr WHERE dr.id = $1"#,
        )
        .bind(contract.deal_room_id).bind(user_id)
        .fetch_optional(&mut *tx).await?.flatten();

        let role = role.ok_or(ContractError::NotAuthorized)?;

        if req.contract_hash != contract.contract_hash {
            warn!(contract_id, user_id, "Hash mismatch — possible tampering");
            return Err(ContractError::HashMismatch);
        }

        match contract.status.as_str() {
            "pending_both" | "pending_brand" | "pending_creator" => {}
            "signed" | "executed" => return Err(ContractError::AlreadySigned),
            other => return Err(ContractError::InvalidStatus(other.to_string())),
        }

        let signature_hash = Self::hash_content(&format!(
            "{}:{}:{}:{}", user_id, contract_id, contract.contract_hash, Utc::now().timestamp()
        ));

        let (sign_col, hash_col, already_signed, other_signed) = if role == "brand" {
            ("brand_signed_at", "brand_signed_hash", contract.brand_signed_at.is_some(), contract.creator_signed_at.is_some())
        } else {
            ("creator_signed_at", "creator_signed_hash", contract.creator_signed_at.is_some(), contract.brand_signed_at.is_some())
        };

        if already_signed { return Err(ContractError::AlreadySigned); }

        let new_status = if other_signed { "signed" }
            else if role == "brand" { "pending_creator" }
            else { "pending_brand" };

        // sign_col and hash_col are hardcoded string literals above — safe for format!
        let updated = sqlx::query_as::<_, ContractInstance>(
            &format!(
                r#"UPDATE contract_instances
                   SET {} = NOW(), {} = $1, status = $2, updated_at = NOW()
                   WHERE id = $3
                   RETURNING id, deal_room_id, template_id, contract_content, contract_hash,
                             pdf_url, status, exact_amount_cents, currency, deliverable_list,
                             revision_cap, kill_fee_pct, advance_pct, exclusivity_days,
                             usage_rights_scope, deadline, brand_signed_at, brand_signed_hash,
                             creator_signed_at, creator_signed_hash, created_at, updated_at"#,
                sign_col, hash_col
            ),
        )
        .bind(&signature_hash).bind(new_status).bind(contract_id)
        .fetch_one(&mut *tx).await?;

        tx.commit().await?;
        info!(contract_id, user_id, role = %role, new_status = %updated.status, "Contract signed");
        Ok(updated)
    }

    pub async fn get_by_id(&self, contract_id: i64, user_id: i64) -> Result<ContractInstance, ContractError> {
        with_timeout(
            sqlx::query_as::<_, ContractInstance>(
                r#"SELECT ci.id, ci.deal_room_id, ci.template_id, ci.contract_content, ci.contract_hash,
                          ci.pdf_url, ci.status, ci.exact_amount_cents, ci.currency, ci.deliverable_list,
                          ci.revision_cap, ci.kill_fee_pct, ci.advance_pct, ci.exclusivity_days,
                          ci.usage_rights_scope, ci.deadline, ci.brand_signed_at, ci.brand_signed_hash,
                          ci.creator_signed_at, ci.creator_signed_hash, ci.created_at, ci.updated_at
                   FROM contract_instances ci
                   JOIN deal_rooms dr ON ci.deal_room_id = dr.id
                   WHERE ci.id = $1 AND (dr.creator_user_id = $2 OR dr.brand_user_id = $2)"#,
            )
            .bind(contract_id).bind(user_id)
            .fetch_optional(&self.read_pool)
        ).await?.ok_or(ContractError::NotFound)
    }

    pub async fn get_by_deal_room(&self, deal_room_id: i64, user_id: i64) -> Result<ContractInstance, ContractError> {
        let participant: bool = with_timeout(
            sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM deal_rooms WHERE id = $1 AND (creator_user_id = $2 OR brand_user_id = $2))",
            )
            .bind(deal_room_id).bind(user_id)
            .fetch_one(&self.read_pool)
        ).await?;

        if !participant { return Err(ContractError::NotAuthorized); }

        with_timeout(
            sqlx::query_as::<_, ContractInstance>(
                r#"SELECT id, deal_room_id, template_id, contract_content, contract_hash,
                          pdf_url, status, exact_amount_cents, currency, deliverable_list,
                          revision_cap, kill_fee_pct, advance_pct, exclusivity_days,
                          usage_rights_scope, deadline, brand_signed_at, brand_signed_hash,
                          creator_signed_at, creator_signed_hash, created_at, updated_at
                   FROM contract_instances WHERE deal_room_id = $1"#,
            )
            .bind(deal_room_id)
            .fetch_optional(&self.read_pool)
        ).await?.ok_or(ContractError::NotFound)
    }

    /// Atomic cap check + insert — no read-then-write race.
    pub async fn request_revision(
        &self,
        user_id: i64,
        contract_id: i64,
        req: &RequestRevisionBody,
    ) -> Result<ContractRevision, ContractError> {
        let contract = self.get_by_id(contract_id, user_id).await?;

        let participant: bool = with_timeout(
            sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM deal_rooms WHERE id = $1 AND (creator_user_id = $2 OR brand_user_id = $2))",
            )
            .bind(contract.deal_room_id).bind(user_id)
            .fetch_one(&self.read_pool)
        ).await?;

        if !participant { return Err(ContractError::NotAuthorized); }

        let is_paid = req.is_paid_revision.unwrap_or(false);

        let revision = with_timeout(
            sqlx::query_as::<_, ContractRevision>(
                r#"WITH rev_count AS (
                       SELECT COUNT(*) AS cnt FROM contract_revisions
                       WHERE contract_instance_id = $1 AND is_paid_revision = FALSE
                   ),
                   next_num AS (
                       SELECT COALESCE(MAX(revision_number), 0) + 1 AS num
                       FROM contract_revisions WHERE contract_instance_id = $1
                   )
                   INSERT INTO contract_revisions
                       (contract_instance_id, revision_number, requested_by_user_id,
                        change_description, is_paid_revision, additional_cost_cents, status)
                   SELECT $1, n.num, $2, $3, $4, $5, 'pending'
                   FROM next_num n, rev_count rc
                   WHERE $4 = TRUE OR rc.cnt < $6
                   RETURNING id, contract_instance_id, revision_number, requested_by_user_id,
                             change_description, is_paid_revision, additional_cost_cents,
                             status, completed_at, created_at"#,
            )
            .bind(contract_id).bind(user_id).bind(&req.change_description)
            .bind(is_paid).bind(req.additional_cost_cents).bind(contract.revision_cap as i64)
            .fetch_optional(&self.pool)
        ).await?.ok_or(ContractError::RevisionCapExceeded)?;

        info!(contract_id, revision = revision.revision_number, paid = is_paid, "Revision requested");
        Ok(revision)
    }

    pub async fn list_templates(&self, query: &TemplateListQuery) -> Result<(Vec<ContractTemplate>, i64), ContractError> {
        let limit = query.limit.unwrap_or(20).min(100) as i64;
        let offset = query.offset.unwrap_or(0).max(0) as i64;

        #[derive(sqlx::FromRow)]
        struct TemplateWithCount {
            id: i64,
            template_name: String,
            template_type: String,
            description: String,
            template_body: String,
            default_revision_cap: i16,
            default_kill_fee_pct: i16,
            default_advance_pct: i16,
            default_exclusivity_days: i32,
            usage_rights_description: String,
            created_at: chrono::DateTime<chrono::Utc>,
            updated_at: chrono::DateTime<chrono::Utc>,
            total_count: i64,
        }

        let rows = with_timeout(
            sqlx::query_as::<_, TemplateWithCount>(
                r#"SELECT id, template_name, template_type, description, template_body,
                          default_revision_cap, default_kill_fee_pct, default_advance_pct,
                          default_exclusivity_days::int4, usage_rights_description, created_at, updated_at,
                          COUNT(*) OVER()::int8 AS total_count
                   FROM contract_templates
                   WHERE ($1::text IS NULL OR template_type = $1)
                   ORDER BY updated_at DESC LIMIT $2 OFFSET $3"#,
            )
            .bind(query.template_type.as_deref()).bind(limit).bind(offset)
            .fetch_all(&self.read_pool)
        ).await?;

        let total_count = rows.first().map(|r| r.total_count).unwrap_or(0);
        let templates = rows.into_iter().map(|r| ContractTemplate {
            id: r.id,
            template_name: r.template_name,
            template_type: r.template_type,
            description: r.description,
            template_body: r.template_body,
            default_revision_cap: r.default_revision_cap,
            default_kill_fee_pct: r.default_kill_fee_pct,
            default_advance_pct: r.default_advance_pct,
            default_exclusivity_days: r.default_exclusivity_days,
            usage_rights_description: r.usage_rights_description,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }).collect();

        Ok((templates, total_count))
    }
}
