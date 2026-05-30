//! S3 storage with presigned URLs
//! Frontend uploads directly to S3, bypassing backend bandwidth

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresignedUrl {
    pub url: String,           // Where to POST the file
    pub upload_id: String,     // Track this upload
    pub expires_at: String,    // ISO8601 timestamp
}

#[derive(Debug, Clone)]
pub struct S3Config {
    pub bucket: String,
    pub region: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub endpoint: Option<String>, // For S3-compatible services
}

pub struct S3Uploader {
    config: S3Config,
}

impl S3Uploader {
    pub fn new(config: S3Config) -> Self {
        Self { config }
    }

    fn allow_insecure_mock_behavior() -> bool {
        std::env::var("ALLOW_INSECURE_STORAGE_MOCKS").ok().as_deref() == Some("true")
            && std::env::var("RUST_ENV").ok().as_deref() != Some("production")
    }

    /// Generate presigned URL for browser upload
    /// Creator uploads video directly to S3, backend never touches video bytes
    pub fn get_presigned_upload_url(
        &self,
        deal_id: &str,
        file_name: &str,
        file_size: i64,
        content_type: &str,
    ) -> Result<PresignedUrl, S3Error> {
        // Validate filename and size
        if !file_name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.') {
            return Err(S3Error::InvalidFilename);
        }

        if file_size > 2_000_000_000 {
            // 2GB max
            return Err(S3Error::FileTooLarge);
        }

        // Generate S3 key (path in bucket)
        let timestamp = chrono::Utc::now().timestamp();
        let upload_id = uuid::Uuid::new_v4().to_string();
        let s3_key = format!("deliverables/{}/{}/{}", deal_id, timestamp, file_name);

        if !Self::allow_insecure_mock_behavior() {
            return Err(S3Error::ConfigError(
                "S3 presigning is not configured; refusing to return unsigned upload URLs".to_string(),
            ));
        }

        // Build mock URL only when explicitly allowed outside production.
        let expires_in = 3600; // 1 hour
        let expires_at = (chrono::Utc::now() + chrono::Duration::hours(1)).to_rfc3339();

        // Simplified: return mock presigned URL
        // Real implementation would sign with AWS credentials
        let url = format!(
            "https://{}.s3.{}.amazonaws.com/{}",
            self.config.bucket, self.config.region, s3_key
        );

        Ok(PresignedUrl {
            url,
            upload_id,
            expires_at,
        })
    }

    /// Generate presigned GET URL (public viewing)
    pub fn get_presigned_view_url(
        &self,
        s3_key: &str,
        expires_in_hours: i32,
    ) -> Result<String, S3Error> {
        let _expires_at = chrono::Utc::now() + chrono::Duration::hours(expires_in_hours as i64);

        if !Self::allow_insecure_mock_behavior() {
            return Err(S3Error::ConfigError(
                "S3 view URL signing is not configured; refusing to return unsigned view URLs".to_string(),
            ));
        }

        let url = format!(
            "https://{}.s3.{}.amazonaws.com/{}",
            self.config.bucket, self.config.region, s3_key
        );

        Ok(url)
    }

    /// Delete file from S3
    pub async fn delete_file(&self, s3_key: &str) -> Result<(), S3Error> {
        if !Self::allow_insecure_mock_behavior() {
            return Err(S3Error::ConfigError(
                "S3 deletion is not configured".to_string(),
            ));
        }

        tracing::info!("Would delete S3 file: {}", s3_key);
        Ok(())
    }

    /// Check if file exists (for verification)
    pub async fn file_exists(&self, s3_key: &str) -> Result<bool, S3Error> {
        if !Self::allow_insecure_mock_behavior() {
            return Err(S3Error::ConfigError(
                "S3 metadata checks are not configured".to_string(),
            ));
        }

        Ok(true)
    }

    /// Get file metadata (size, upload time)
    pub async fn get_file_metadata(&self, s3_key: &str) -> Result<FileMetadata, S3Error> {
        if !Self::allow_insecure_mock_behavior() {
            return Err(S3Error::ConfigError(
                "S3 metadata checks are not configured".to_string(),
            ));
        }

        Ok(FileMetadata {
            size_bytes: 1_000_000_000,
            uploaded_at: chrono::Utc::now(),
            content_type: "video/mp4".to_string(),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub size_bytes: i64,
    pub uploaded_at: chrono::DateTime<chrono::Utc>,
    pub content_type: String,
}

#[derive(Debug)]
pub enum S3Error {
    InvalidFilename,
    FileTooLarge,
    UploadFailed(String),
    NotFound,
    ConfigError(String),
}

impl std::fmt::Display for S3Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            S3Error::InvalidFilename => write!(f, "Invalid filename"),
            S3Error::FileTooLarge => write!(f, "File exceeds 2GB limit"),
            S3Error::UploadFailed(e) => write!(f, "Upload failed: {}", e),
            S3Error::NotFound => write!(f, "File not found"),
            S3Error::ConfigError(e) => write!(f, "Configuration error: {}", e),
        }
    }
}

impl std::error::Error for S3Error {}
