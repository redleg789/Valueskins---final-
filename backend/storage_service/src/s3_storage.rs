//! S3 Storage Service — Video/file uploads with presigned URLs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresignedUrl {
    pub url: String,
    pub expires_in_seconds: i32,
    pub key: String,
    pub bucket: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadMetadata {
    pub key: String,
    pub size_bytes: i64,
    pub mime_type: String,
    pub uploaded_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug)]
pub enum StorageError {
    NotConfigured,
    InvalidBucket,
    InvalidKey,
    UploadFailed(String),
    AccessDenied,
}

pub struct S3StorageService {
    bucket: String,
    region: String,
    expiry_seconds: i32,
}

impl S3StorageService {
    pub fn new(bucket: String, region: String) -> Self {
        Self {
            bucket,
            region,
            expiry_seconds: 900, // 15 minutes
        }
    }

    /// Generate presigned PUT URL for creator to upload deliverable
    pub async fn generate_upload_url(
        &self,
        user_id: i64,
        deal_id: i64,
        filename: &str,
    ) -> Result<PresignedUrl, StorageError> {
        if self.bucket.is_empty() {
            return Err(StorageError::NotConfigured);
        }

        let config = aws_config::load_from_env().await;
        let client = aws_sdk_s3::Client::new(&config);

        let timestamp = chrono::Utc::now().timestamp();
        let key = format!("deliverables/{}/{}/{}_{}", user_id, deal_id, timestamp, filename);

        let presigned = client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .presigned(aws_sdk_s3::presigning::PresigningConfig::builder()
                .expires_in(std::time::Duration::from_secs(self.expiry_seconds as u64))
                .build()
                .map_err(|_| StorageError::UploadFailed("Presigning config error".to_string()))?)
            .await
            .map_err(|e| StorageError::UploadFailed(e.to_string()))?;

        Ok(PresignedUrl {
            url: presigned.uri().to_string(),
            expires_in_seconds: self.expiry_seconds,
            key,
            bucket: self.bucket.clone(),
        })
    }

    /// Generate presigned GET URL for brand to view deliverable
    pub async fn generate_download_url(&self, key: &str) -> Result<PresignedUrl, StorageError> {
        if self.bucket.is_empty() {
            return Err(StorageError::NotConfigured);
        }

        let config = aws_config::load_from_env().await;
        let client = aws_sdk_s3::Client::new(&config);

        let presigned = client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .presigned(aws_sdk_s3::presigning::PresigningConfig::builder()
                .expires_in(std::time::Duration::from_secs(86400))
                .build()
                .map_err(|_| StorageError::UploadFailed("Presigning config error".to_string()))?)
            .await
            .map_err(|e| StorageError::UploadFailed(e.to_string()))?;

        Ok(PresignedUrl {
            url: presigned.uri().to_string(),
            expires_in_seconds: 86400,
            key: key.to_string(),
            bucket: self.bucket.clone(),
        })
    }

    /// Get file metadata from S3
    pub async fn get_metadata(&self, key: &str) -> Result<UploadMetadata, StorageError> {
        let config = aws_config::load_from_env().await;
        let client = aws_sdk_s3::Client::new(&config);

        let obj = client
            .head_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| StorageError::UploadFailed(e.to_string()))?;

        let size = obj.content_length().unwrap_or(0) as i64;
        let mime = obj.content_type().unwrap_or("application/octet-stream").to_string();
        let modified = obj.last_modified().and_then(|t| t.to_chrono_utc().ok()).unwrap_or_else(chrono::Utc::now);

        Ok(UploadMetadata {
            key: key.to_string(),
            size_bytes: size,
            mime_type: mime,
            uploaded_at: modified,
            expires_at: chrono::Utc::now() + chrono::Duration::days(90),
        })
    }

    /// Delete file from S3
    pub async fn delete_file(&self, key: &str) -> Result<(), StorageError> {
        let config = aws_config::load_from_env().await;
        let client = aws_sdk_s3::Client::new(&config);

        client
            .delete_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| StorageError::UploadFailed(e.to_string()))?;

        Ok(())
    }

    /// List all files for a creator (pagination support)
    pub async fn list_creator_files(
        &self,
        user_id: i64,
        limit: i32,
        continuation_token: Option<String>,
    ) -> Result<(Vec<UploadMetadata>, Option<String>), StorageError> {
        let config = aws_config::load_from_env().await;
        let client = aws_sdk_s3::Client::new(&config);

        let prefix = format!("deliverables/{}/", user_id);

        let mut list_req = client
            .list_objects_v2()
            .bucket(&self.bucket)
            .prefix(&prefix)
            .max_keys(limit);

        if let Some(token) = continuation_token {
            list_req = list_req.continuation_token(token);
        }

        let resp = list_req
            .send()
            .await
            .map_err(|e| StorageError::UploadFailed(e.to_string()))?;

        let mut files = Vec::new();
        if let Some(contents) = resp.contents() {
            for obj in contents {
                if let Some(key) = obj.key() {
                    files.push(UploadMetadata {
                        key: key.to_string(),
                        size_bytes: obj.size().unwrap_or(0) as i64,
                        mime_type: "video/mp4".to_string(),
                        uploaded_at: obj.last_modified().and_then(|t| t.to_chrono_utc().ok()).unwrap_or_else(chrono::Utc::now),
                        expires_at: chrono::Utc::now() + chrono::Duration::days(90),
                    });
                }
            }
        }

        let next_token = resp.continuation_token().map(|s| s.to_string());

        Ok((files, next_token))
    }
}

/// CloudFront CDN for playback
pub struct CloudFrontCdn {
    distribution_id: String,
    domain: String,
}

impl CloudFrontCdn {
    pub fn new(distribution_id: String, domain: String) -> Self {
        Self { distribution_id, domain }
    }

    /// Convert S3 key to CloudFront URL (for fast playback)
    pub fn get_playback_url(&self, s3_key: &str) -> String {
        format!("https://{}/{}", self.domain, s3_key)
    }

    /// Invalidate CloudFront cache (when file updated/deleted)
    pub async fn invalidate_cache(&self, paths: Vec<String>) -> Result<(), StorageError> {
        let config = aws_config::load_from_env().await;
        let client = aws_sdk_cloudfront::Client::new(&config);

        let items: Vec<String> = paths.iter().map(|p| format!("/{}", p)).collect();

        client
            .create_invalidation()
            .distribution_id(&self.distribution_id)
            .invalidation_batch(
                aws_sdk_cloudfront::types::InvalidationBatch::builder()
                    .paths(
                        aws_sdk_cloudfront::types::Paths::builder()
                            .quantity(items.len() as i32)
                            .items(items)
                            .build()
                            .map_err(|_| StorageError::UploadFailed("Batch build error".to_string()))?
                    )
                    .caller_reference(chrono::Utc::now().timestamp().to_string())
                    .build()
                    .map_err(|_| StorageError::UploadFailed("Batch build error".to_string()))?
            )
            .send()
            .await
            .map_err(|e| StorageError::UploadFailed(e.to_string()))?;

        Ok(())
    }
}
