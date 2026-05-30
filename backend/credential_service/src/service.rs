use crate::models::*;
use chrono::Utc;
use sha2::{Digest, Sha256};
use sqlx::PgPool;

pub struct CredentialService {
    pool: PgPool,
}

impl CredentialService {
    pub fn new(pool: PgPool) -> Self {
        CredentialService { pool }
    }

    fn hash_proof(data: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data.as_bytes());
        hex::encode(hasher.finalize())
    }

    // Link credential with SHA-256 hashed proof
    pub async fn link_credential(
        &self,
        user_id: i64,
        req: LinkCredentialRequest,
    ) -> Result<(), ServiceError> {
        let proof_hash = Self::hash_proof(&req.verification_token);
        let now = Utc::now();

        sqlx::query(
            "INSERT INTO creator_credentials (user_id, platform, external_handle, verification_proof, verified_at, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5, TRUE, $6)
             ON CONFLICT (user_id, platform) DO UPDATE SET
               external_handle = EXCLUDED.external_handle,
               verification_proof = EXCLUDED.verification_proof,
               verified_at = EXCLUDED.verified_at,
               is_active = TRUE,
               updated_at = EXCLUDED.updated_at"
        )
        .bind(user_id)
        .bind(&req.platform)
        .bind(&req.external_handle)
        .bind(&proof_hash)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        Ok(())
    }

    pub async fn list_credentials(&self, user_id: i64) -> Result<Vec<CreatorCredential>, ServiceError> {
        let credentials = sqlx::query_as::<_, CreatorCredential>(
            "SELECT user_id, platform, external_handle, verified_at, verification_proof, is_active
             FROM creator_credentials
             WHERE user_id = $1 AND is_active = TRUE
             ORDER BY platform"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        Ok(credentials)
    }

    // Link identity proof with SHA-256 hashed URL
    pub async fn link_identity(
        &self,
        user_id: i64,
        req: LinkIdentityRequest,
    ) -> Result<(), ServiceError> {
        let proof_hash = Self::hash_proof(&req.proof_url);
        let now = Utc::now();

        sqlx::query(
            "INSERT INTO identity_proofs (user_id, platform, external_handle, proof_url, proof_hash, verified_at, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
             ON CONFLICT (user_id, platform) DO UPDATE SET
               external_handle = EXCLUDED.external_handle,
               proof_url = EXCLUDED.proof_url,
               proof_hash = EXCLUDED.proof_hash,
               verified_at = EXCLUDED.verified_at,
               is_active = TRUE,
               updated_at = EXCLUDED.updated_at"
        )
        .bind(user_id)
        .bind(&req.platform)
        .bind(&req.external_handle)
        .bind(&req.proof_url)
        .bind(&proof_hash)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        Ok(())
    }

    pub async fn list_identity_proofs(&self, user_id: i64) -> Result<Vec<IdentityProof>, ServiceError> {
        let proofs = sqlx::query_as::<_, IdentityProof>(
            "SELECT user_id, platform, external_handle, proof_url, proof_hash, verified_at, is_active
             FROM identity_proofs
             WHERE user_id = $1 AND is_active = TRUE
             ORDER BY platform"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        Ok(proofs)
    }

    /// Public profile: only returns platform + handle + verified status.
    /// Does NOT expose proof hashes, tokens, or proof URLs.
    pub async fn get_combined_profile(
        &self,
        user_id: i64,
    ) -> Result<CombinedVerificationResponse, ServiceError> {
        // Use dedicated queries that exclude sensitive columns
        let credentials = sqlx::query_as::<_, CreatorCredential>(
            "SELECT user_id, platform, external_handle, verified_at, '' AS verification_proof, is_active
             FROM creator_credentials
             WHERE user_id = $1 AND is_active = TRUE
             ORDER BY platform"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        let proofs = sqlx::query_as::<_, IdentityProof>(
            "SELECT user_id, platform, external_handle, '' AS proof_url, '' AS proof_hash, verified_at, is_active
             FROM identity_proofs
             WHERE user_id = $1 AND is_active = TRUE
             ORDER BY platform"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        let credential_responses: Vec<CredentialResponse> = credentials
            .into_iter()
            .map(|c| CredentialResponse {
                platform: c.platform.clone(),
                external_handle: c.external_handle.clone(),
                verified: c.verified_at.is_some(),
                verified_at: c.verified_at,
                display_name: format!("{}: @{}", capitalize(&c.platform), c.external_handle),
            })
            .collect();

        let proof_responses: Vec<IdentityProofResponse> = proofs
            .into_iter()
            .map(|p| IdentityProofResponse {
                platform: p.platform.clone(),
                external_handle: p.external_handle.clone(),
                verified: p.verified_at.is_some(),
                verified_at: p.verified_at,
                display_name: format!("{}: @{}", capitalize(&p.platform), p.external_handle),
            })
            .collect();

        let total_verified = credential_responses.iter().filter(|c| c.verified).count()
            + proof_responses.iter().filter(|p| p.verified).count();

        Ok(CombinedVerificationResponse {
            credentials: credential_responses,
            identity_proofs: proof_responses,
            total_verified,
        })
    }
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}
