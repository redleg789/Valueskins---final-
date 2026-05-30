//! File Upload Validation
//!
//! Enforces size limits, MIME type allowlists, and file count limits
//! on deliverable uploads. Without this, an attacker uploads a 10GB file
//! and kills storage, or uploads an executable disguised as an image.

const MAX_FILE_SIZE_BYTES: u64 = 50 * 1024 * 1024; // 50MB
const MAX_FILES_PER_UPLOAD: usize = 10;

const ALLOWED_MIME_TYPES: &[&str] = &[
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/quicktime",
    "application/pdf",
    "text/plain", "text/csv",
    "application/zip",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
];

const BLOCKED_EXTENSIONS: &[&str] = &[
    ".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll",
    ".js", ".vbs", ".wsf", ".scr", ".com", ".pif",
];

#[derive(Debug)]
pub enum UploadError {
    FileTooLarge { max_bytes: u64, actual_bytes: u64 },
    TooManyFiles { max: usize },
    DisallowedMimeType { mime: String },
    BlockedExtension { ext: String },
    MissingFilename,
}

impl std::fmt::Display for UploadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UploadError::FileTooLarge { max_bytes, actual_bytes } =>
                write!(f, "File too large: {} bytes (max {})", actual_bytes, max_bytes),
            UploadError::TooManyFiles { max } =>
                write!(f, "Too many files (max {})", max),
            UploadError::DisallowedMimeType { mime } =>
                write!(f, "File type not allowed: {}", mime),
            UploadError::BlockedExtension { ext } =>
                write!(f, "File extension blocked: {}", ext),
            UploadError::MissingFilename =>
                write!(f, "Filename is required"),
        }
    }
}

/// Validate a single file upload.
pub fn validate_file(
    filename: &str,
    content_type: &str,
    size_bytes: u64,
) -> Result<(), UploadError> {
    if filename.is_empty() {
        return Err(UploadError::MissingFilename);
    }

    if size_bytes > MAX_FILE_SIZE_BYTES {
        return Err(UploadError::FileTooLarge {
            max_bytes: MAX_FILE_SIZE_BYTES,
            actual_bytes: size_bytes,
        });
    }

    // Check blocked extensions
    let lower = filename.to_lowercase();
    for ext in BLOCKED_EXTENSIONS {
        if lower.ends_with(ext) {
            return Err(UploadError::BlockedExtension { ext: ext.to_string() });
        }
    }

    // Check MIME type allowlist
    if !ALLOWED_MIME_TYPES.contains(&content_type) {
        return Err(UploadError::DisallowedMimeType { mime: content_type.to_string() });
    }

    Ok(())
}

/// Validate a batch of file uploads.
pub fn validate_batch(
    files: &[(String, String, u64)], // (filename, content_type, size)
) -> Result<(), UploadError> {
    if files.len() > MAX_FILES_PER_UPLOAD {
        return Err(UploadError::TooManyFiles { max: MAX_FILES_PER_UPLOAD });
    }

    for (name, mime, size) in files {
        validate_file(name, mime, *size)?;
    }

    Ok(())
}
