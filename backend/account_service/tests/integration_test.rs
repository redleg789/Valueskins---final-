use account_service::errors::AccountError;

fn db_error() -> AccountError {
    AccountError::Database(sqlx::Error::Protocol("test error".to_string()))
}

// ── AccountError Display ──

#[test]
fn account_error_not_found_display() {
    assert_eq!(format!("{}", AccountError::NotFound), "Account not found");
}

#[test]
fn account_error_forbidden_display() {
    let err = AccountError::Forbidden("insufficient permissions".to_string());
    assert_eq!(format!("{}", err), "Forbidden: insufficient permissions");
}

#[test]
fn account_error_module_not_found_display() {
    assert_eq!(format!("{}", AccountError::ModuleNotFound), "Module not found");
}

#[test]
fn account_error_module_already_active_display() {
    assert_eq!(format!("{}", AccountError::ModuleAlreadyActive), "Module is already active");
}

#[test]
fn account_error_module_not_active_display() {
    assert_eq!(format!("{}", AccountError::ModuleNotActive), "Module is not active");
}

#[test]
fn account_error_cannot_deactivate_last_module_display() {
    assert_eq!(format!("{}", AccountError::CannotDeactivateLastModule), "Cannot deactivate the last module");
}

#[test]
fn account_error_invalid_preferences_display() {
    assert_eq!(format!("{}", AccountError::InvalidPreferences), "Invalid preferences");
}

#[test]
fn account_error_database_display() {
    assert_eq!(format!("{}", db_error()), "Database error: protocol error: test error");
}

// ── AccountError From<SqlxError> ──

#[test]
fn converts_sqlx_error_to_account_database_error() {
    let sqlx_err = sqlx::Error::PoolTimedOut;
    let account_err: AccountError = sqlx_err.into();
    assert!(matches!(account_err, AccountError::Database(_)));
}
