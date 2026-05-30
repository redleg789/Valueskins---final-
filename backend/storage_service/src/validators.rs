//! File validation for uploads

pub struct FileValidator;

impl FileValidator {
    /// Validate video file
    pub fn validate_video(
        file_name: &str,
        file_size: i64,
        content_type: &str,
    ) -> Result<(), ValidationError> {
        // Check file extension
        let allowed_exts = vec!["mp4", "mov", "webm", "mkv"];
        let ext = file_name
            .split('.')
            .last()
            .ok_or(ValidationError::InvalidExtension)?
            .to_lowercase();

        if !allowed_exts.contains(&ext.as_str()) {
            return Err(ValidationError::InvalidExtension);
        }

        // Check file size (max 2GB)
        if file_size > 2_000_000_000 {
            return Err(ValidationError::FileTooLarge);
        }

        // Check MIME type
        let allowed_mimes = vec![
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/x-matroska",
        ];

        if !allowed_mimes.contains(&content_type) {
            return Err(ValidationError::InvalidMimeType);
        }

        Ok(())
    }

    /// Validate image file (for thumbnails, profiles)
    pub fn validate_image(
        file_name: &str,
        file_size: i64,
        content_type: &str,
    ) -> Result<(), ValidationError> {
        // Check file extension
        let allowed_exts = vec!["jpg", "jpeg", "png", "webp", "gif"];
        let ext = file_name
            .split('.')
            .last()
            .ok_or(ValidationError::InvalidExtension)?
            .to_lowercase();

        if !allowed_exts.contains(&ext.as_str()) {
            return Err(ValidationError::InvalidExtension);
        }

        // Check file size (max 50MB)
        if file_size > 50_000_000 {
            return Err(ValidationError::FileTooLarge);
        }

        // Check MIME type
        let allowed_mimes = vec!["image/jpeg", "image/png", "image/webp", "image/gif"];

        if !allowed_mimes.contains(&content_type) {
            return Err(ValidationError::InvalidMimeType);
        }

        Ok(())
    }

    /// Validate document file (contracts, briefs)
    pub fn validate_document(
        file_name: &str,
        file_size: i64,
        content_type: &str,
    ) -> Result<(), ValidationError> {
        // Check file extension
        let allowed_exts = vec!["pdf", "docx", "doc", "txt"];
        let ext = file_name
            .split('.')
            .last()
            .ok_or(ValidationError::InvalidExtension)?
            .to_lowercase();

        if !allowed_exts.contains(&ext.as_str()) {
            return Err(ValidationError::InvalidExtension);
        }

        // Check file size (max 10MB)
        if file_size > 10_000_000 {
            return Err(ValidationError::FileTooLarge);
        }

        // Check MIME type
        let allowed_mimes = vec![
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
        ];

        if !allowed_mimes.contains(&content_type) {
            return Err(ValidationError::InvalidMimeType);
        }

        Ok(())
    }

    /// Sanitize filename
    pub fn sanitize_filename(file_name: &str) -> String {
        file_name
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                    c
                } else {
                    '_'
                }
            })
            .collect()
    }
}

#[derive(Debug)]
pub enum ValidationError {
    InvalidExtension,
    FileTooLarge,
    InvalidMimeType,
    ZeroSize,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValidationError::InvalidExtension => write!(f, "File extension not allowed"),
            ValidationError::FileTooLarge => write!(f, "File exceeds size limit"),
            ValidationError::InvalidMimeType => write!(f, "File type not allowed"),
            ValidationError::ZeroSize => write!(f, "File is empty"),
        }
    }
}

impl std::error::Error for ValidationError {}
