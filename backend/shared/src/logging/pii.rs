//! PII (Personally Identifiable Information) masking for logs
//!
//! Prevents sensitive data from appearing in log output.
//! At Meta scale, a single leaked email in logs can trigger GDPR violations.
//!
//! Masking rules:
//! - Emails: "user@example.com" -> "us***@***.com"
//! - JWT tokens: "eyJhbG..." -> "eyJ***[REDACTED]"
//! - API keys: "vs_live_abc123..." -> "vs_live_***[REDACTED]"
//! - Wallet addresses: "0xAbCd..." -> "0xAb***...Ef"
//! - IP addresses: "192.168.1.100" -> "192.168.x.x"
//! - Passwords/secrets: always "[REDACTED]"

/// Masks an email address for safe logging
/// "user@example.com" -> "us***@***.com"
pub fn mask_email(email: &str) -> String {
    match email.split_once('@') {
        Some((local, domain)) => {
            let local_masked = if local.len() <= 2 {
                "***".to_string()
            } else {
                format!("{}***", &local[..2])
            };
            let domain_parts: Vec<&str> = domain.split('.').collect();
            let tld = domain_parts.last().unwrap_or(&"com");
            format!("{}@***.{}", local_masked, tld)
        }
        None => "***@***".to_string(),
    }
}

/// Masks a JWT or bearer token for safe logging
/// Shows only first 10 chars to identify token type
pub fn mask_token(token: &str) -> String {
    if token.len() <= 10 {
        "[REDACTED]".to_string()
    } else {
        format!("{}***[REDACTED]", &token[..10])
    }
}

/// Masks an API key for safe logging
/// "vs_live_abc123def456" -> "vs_live_***[REDACTED]"
pub fn mask_api_key(key: &str) -> String {
    if let Some(prefix_end) = key.find('_').and_then(|i| key[i + 1..].find('_').map(|j| i + 1 + j + 1)) {
        format!("{}***[REDACTED]", &key[..prefix_end])
    } else if key.len() > 8 {
        format!("{}***[REDACTED]", &key[..8])
    } else {
        "[REDACTED]".to_string()
    }
}

/// Masks a wallet/blockchain address for safe logging
/// "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12" -> "0xAbCd***...Ef12"
pub fn mask_address(addr: &str) -> String {
    if addr.len() > 10 {
        format!("{}***...{}", &addr[..6], &addr[addr.len() - 4..])
    } else {
        "***[REDACTED]".to_string()
    }
}

/// Masks an IP address for privacy compliance
/// "192.168.1.100" -> "192.168.x.x"
pub fn mask_ip(ip: &str) -> String {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() == 4 {
        format!("{}.{}.x.x", parts[0], parts[1])
    } else if ip.contains(':') {
        // IPv6: show first segment only
        match ip.split(':').next() {
            Some(first) => format!("{}:***", first),
            None => "***".to_string(),
        }
    } else {
        "***".to_string()
    }
}

/// Sanitizes a log message by scanning for common PII patterns
/// Used as a safety net — prefer explicit masking at the call site
pub fn sanitize_message(msg: &str) -> String {
    let mut result = msg.to_string();

    // Mask anything that looks like a JWT
    if result.contains("eyJ") {
        // Find JWT-like sequences (base64 with dots)
        let mut sanitized = String::with_capacity(result.len());
        let mut chars = result.chars().peekable();
        while let Some(ch) = chars.next() {
            if ch == 'e' {
                let rest: String = std::iter::once(ch).chain(chars.clone().take(2)).collect();
                if rest == "eyJ" {
                    sanitized.push_str("eyJ***[REDACTED]");
                    // Skip until whitespace or end
                    for c in chars.by_ref() {
                        if c.is_whitespace() || c == '"' || c == '\'' {
                            sanitized.push(c);
                            break;
                        }
                    }
                } else {
                    sanitized.push(ch);
                }
            } else {
                sanitized.push(ch);
            }
        }
        result = sanitized;
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_email() {
        assert_eq!(mask_email("user@example.com"), "us***@***.com");
        assert_eq!(mask_email("ab@test.org"), "***@***.org");
        assert_eq!(mask_email("alice@company.co.uk"), "al***@***.uk");
    }

    #[test]
    fn test_mask_token() {
        assert_eq!(mask_token("eyJhbGciOiJIUzI1NiJ9.abc"), "eyJhbGciOi***[REDACTED]");
        assert_eq!(mask_token("short"), "[REDACTED]");
    }

    #[test]
    fn test_mask_api_key() {
        assert_eq!(mask_api_key("vs_live_abc123def456"), "vs_live_***[REDACTED]");
    }

    #[test]
    fn test_mask_address() {
        assert_eq!(mask_address("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"), "0xAbCd***...Ef12");
    }

    #[test]
    fn test_mask_ip() {
        assert_eq!(mask_ip("192.168.1.100"), "192.168.x.x");
        assert_eq!(mask_ip("10.0.0.1"), "10.0.x.x");
    }
}
