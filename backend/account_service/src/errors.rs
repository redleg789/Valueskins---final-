use actix_web::HttpResponse;
use serde_json::json;
use sqlx::Error as SqlxError;
use std::fmt;

#[derive(Debug)]
pub enum AccountError {
    NotFound,
    Forbidden(String),
    ModuleNotFound,
    ModuleAlreadyActive,
    ModuleNotActive,
    CannotDeactivateLastModule,
    InvalidPreferences,
    Database(SqlxError),
}

impl fmt::Display for AccountError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AccountError::NotFound => write!(f, "Account not found"),
            AccountError::Forbidden(msg) => write!(f, "Forbidden: {}", msg),
            AccountError::ModuleNotFound => write!(f, "Module not found"),
            AccountError::ModuleAlreadyActive => write!(f, "Module is already active"),
            AccountError::ModuleNotActive => write!(f, "Module is not active"),
            AccountError::CannotDeactivateLastModule => write!(f, "Cannot deactivate the last module"),
            AccountError::InvalidPreferences => write!(f, "Invalid preferences"),
            AccountError::Database(e) => write!(f, "Database error: {}", e),
        }
    }
}

impl From<SqlxError> for AccountError {
    fn from(e: SqlxError) -> Self {
        AccountError::Database(e)
    }
}

pub fn error_response(err: AccountError) -> HttpResponse {
    match err {
        AccountError::NotFound => {
            HttpResponse::NotFound().json(json!({"error": "Account not found"}))
        }
        AccountError::Forbidden(msg) => {
            HttpResponse::Forbidden().json(json!({"error": msg}))
        }
        AccountError::ModuleNotFound | AccountError::ModuleAlreadyActive
        | AccountError::ModuleNotActive | AccountError::CannotDeactivateLastModule
        | AccountError::InvalidPreferences => {
            HttpResponse::BadRequest().json(json!({"error": err.to_string()}))
        }
        AccountError::Database(e) => {
            tracing::error!(error = %e, "Account service DB error");
            HttpResponse::InternalServerError().json(json!({"error": "Internal server error"}))
        }
    }
}
