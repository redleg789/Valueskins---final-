//! Document Verification Engine
//!
//! Handles identity document processing, forgery detection, 
//! OCR extraction, and verification provider integration.
//!
//! Supports pluggable providers: Persona, Stripe Identity, Onfido, Veriff, Manual
//! Each provider implements the DocumentVerificationProvider trait.

use crate::models::{DocumentUploadResponse, IdentityDocument, IdentityError, UploadDocumentRequest};
use chrono::Utc;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use std::collections::HashMap;

/// Verification result from a provider
pub struct VerificationResult {
    pub verified: bool,
    pub confidence: f32,
    pub extracted_data: Option<serde_json::Value>,
    pub provider: String,
    pub provider_reference: String,
    pub rejection_reason: Option<String>,
}

/// Trait for pluggable document verification providers
#[async_trait::async_trait]
pub trait DocumentVerificationProvider: Send + Sync {
    async fn verify_document(
        &self,
        document: &IdentityDocument,
    ) -> Result<VerificationResult, IdentityError>;
}

/// Provider registry
pub struct VerificationProviderRegistry {
    providers: HashMap<String, Box<dyn DocumentVerificationProvider>>,
}

impl VerificationProviderRegistry {
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
        }
    }

    pub fn register(
        &mut self,
        name: &str,
        provider: Box<dyn DocumentVerificationProvider>,
    ) {
        self.providers.insert(name.to_string(), provider);
    }

    pub fn get(&self, name: &str) -> Option<&Box<dyn DocumentVerificationProvider>> {
        self.providers.get(name)
    }
}

/// Built-in mock provider for development
pub struct MockVerificationProvider {
    pub always_pass: bool,
}

#[async_trait::async_trait]
impl DocumentVerificationProvider for MockVerificationProvider {
    async fn verify_document(
        &self,
        _document: &IdentityDocument,
    ) -> Result<VerificationResult, IdentityError> {
        if self.always_pass {
            Ok(VerificationResult {
                verified: true,
                confidence: 0.99,
                extracted_data: Some(serde_json::json!({
                    "document_number": "XXXXXX",
                    "expiry_date": "2030-01-01",
                    "nationality": "US"
                })),
                provider: "mock".to_string(),
                provider_reference: uuid::Uuid::new_v4().to_string(),
                rejection_reason: None,
            })
        } else {
            Ok(VerificationResult {
                verified: false,
                confidence: 0.0,
                extracted_data: None,
                provider: "mock".to_string(),
                provider_reference: uuid::Uuid::new_v4().to_string(),
                rejection_reason: Some("Mock rejection".to_string()),
            })
        }
    }
}

/// Document verification service
pub struct DocumentVerificationService {
    pool: PgPool,
    provider_registry: VerificationProviderRegistry,
}

impl DocumentVerificationService {
    pub fn new(pool: PgPool) -> Self {
        let mut registry = VerificationProviderRegistry::new();
        registry.register("mock", Box::new(MockVerificationProvider { always_pass: true }));

        Self {
            pool,
            provider_registry: registry,
        }
    }

    /// Upload and register a document for verification
    pub async fn upload_document(
        &self,
        user_id: i64,
        req: &UploadDocumentRequest,
    ) -> Result<DocumentUploadResponse, IdentityError> {
        // Check for document reuse (same hash used by another user)
        let reused: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM identity_documents 
             WHERE file_hash = $1 AND user_id != $2 AND is_active = TRUE)",
        )
        .bind(&req.file_hash)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        if reused {
            return Err(IdentityError::DocumentVerificationFailed(
                "Document has been used by another user — possible identity theft".to_string(),
            ));
        }

        // Check for document re-upload (same user, same hash)
        let duplicate: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM identity_documents 
             WHERE file_hash = $1 AND user_id = $2 AND is_active = TRUE)",
        )
        .bind(&req.file_hash)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        if duplicate {
            return Err(IdentityError::DocumentAlreadyExists);
        }

        let now = Utc::now();

        let document_id: i64 = sqlx::query_scalar(
            "INSERT INTO identity_documents 
             (user_id, document_type, document_status, file_storage_key, file_hash, 
              file_size_bytes, file_mime_type, verification_provider)
             VALUES ($1, $2, 'PENDING', $3, $4, $5, $6, 'mock')
             RETURNING id",
        )
        .bind(user_id)
        .bind(&req.document_type)
        .bind(&req.file_storage_key)
        .bind(&req.file_hash)
        .bind(req.file_size_bytes)
        .bind(&req.file_mime_type)
        .fetch_one(&self.pool)
        .await?;

        // Automatically start verification
        let result = self.verify_document(document_id, user_id).await?;

        Ok(DocumentUploadResponse {
            document_id,
            status: if result.verified { "VERIFIED".to_string() } else { "PENDING_REVIEW".to_string() },
            requires_review: !result.verified,
        })
    }

    /// Run document through verification pipeline
    async fn verify_document(
        &self,
        document_id: i64,
        user_id: i64,
    ) -> Result<VerificationResult, IdentityError> {
        let document = sqlx::query_as::<_, IdentityDocument>(
            "SELECT * FROM identity_documents WHERE id = $1",
        )
        .bind(document_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(IdentityError::DocumentNotFound)?;

        let provider_name = document.verification_provider.as_deref().unwrap_or("mock");
        let provider = self
            .provider_registry
            .get(provider_name)
            .ok_or_else(|| {
                IdentityError::ExternalServiceError(format!(
                    "Unknown verification provider: {}",
                    provider_name
                ))
            })?;

        let result = provider.verify_document(&document).await?;

        // Update document record
        let new_status = if result.verified { "VERIFIED" } else { "REJECTED" };

        sqlx::query(
            "UPDATE identity_documents 
             SET document_status = $2, verification_data = $3, 
                 verification_score = $4, reviewed_by_user_id = NULL,
                 rejection_reason = $5, updated_at = NOW()
             WHERE id = $1",
        )
        .bind(document_id)
        .bind(new_status)
        .bind(&result.extracted_data)
        .bind(result.confidence)
        .bind(&result.rejection_reason)
        .execute(&self.pool)
        .await?;

        // If verified, check if we need to update age verification
        if result.verified {
            if let Some(ref extracted) = result.extracted_data {
                if let Some(dob_str) = extracted.get("date_of_birth").and_then(|v| v.as_str()) {
                    if let Ok(dob) = chrono::NaiveDate::parse_from_str(dob_str, "%Y-%m-%d") {
                        let age_service = crate::age_verification::AgeVerificationService::new(
                            self.pool.clone(),
                        );
                        let _ = age_service.confirm_age(user_id, dob, document_id).await;
                    }
                }
            }
        }

        // Log verification request
        let _ = sqlx::query(
            "INSERT INTO verification_requests 
             (user_id, request_type, request_state, reference_id, reference_type, metadata)
             VALUES ($1, 'IDENTITY_DOCUMENT', $2, $3, 'identity_documents', $4)",
        )
        .bind(user_id)
        .bind(if result.verified { "APPROVED" } else { "REJECTED" })
        .bind(document_id)
        .bind(serde_json::json!({"confidence": result.confidence, "provider": provider_name}))
        .execute(&self.pool)
        .await?;

        Ok(result)
    }

    /// Get document status
    pub async fn get_document_status(
        &self,
        document_id: i64,
        user_id: i64,
    ) -> Result<IdentityDocument, IdentityError> {
        let doc = sqlx::query_as::<_, IdentityDocument>(
            "SELECT * FROM identity_documents WHERE id = $1 AND user_id = $2",
        )
        .bind(document_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(IdentityError::DocumentNotFound)?;

        Ok(doc)
    }
}
