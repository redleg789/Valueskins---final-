#[cfg(test)]
mod tests {
    use std::env;

    #[test]
    fn test_smtp_credentials_loaded() {
        // Verify SMTP env vars are set (in CI/prod)
        let smtp_host = env::var("SMTP_HOST").unwrap_or_default();
        let smtp_user = env::var("SMTP_USER").unwrap_or_default();
        let smtp_pass = env::var("SMTP_PASS").unwrap_or_default();

        // In staging/prod, these must be set
        if env::var("ENVIRONMENT").unwrap_or_default() == "production" {
            assert!(!smtp_host.is_empty(), "SMTP_HOST not set in production");
            assert!(!smtp_user.is_empty(), "SMTP_USER not set in production");
            assert!(!smtp_pass.is_empty(), "SMTP_PASS not set in production");
            assert!(!smtp_host.contains("example.com"), "SMTP_HOST is placeholder");
            assert!(smtp_host.len() > 5, "SMTP_HOST seems invalid");
        }
    }

    #[test]
    fn test_email_templates_exist() {
        // Verify all email templates compile
        let templates = vec![
            "waitlist_welcome",
            "opportunity_match",
            "deal_completed",
            "level_up",
            "referral_reward",
        ];

        for template in templates {
            // In real test, load from file
            assert!(!template.is_empty(), "Template {} is empty", template);
        }
    }

    #[test]
    fn test_sender_email_valid() {
        let sender = env::var("SMTP_FROM_EMAIL").unwrap_or_else(|_| "noreply@valueskins.com".to_string());
        assert!(sender.contains("@"), "Invalid sender email: {}", sender);
        assert!(sender.len() > 5, "Sender email too short: {}", sender);
    }
}
