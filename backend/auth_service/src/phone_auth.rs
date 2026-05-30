//! Phone OTP Authentication
//!
//! Implements phone-based authentication using one-time passwords.
//! OTPs are stored in Redis (in production) or in a TTL-based memory store.
//! The phone number is normalized to E.164 format.

use chrono::{Utc, DateTime};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtpEntry {
    pub phone: String,
    pub code: String,
    pub expires_at: DateTime<Utc>,
    pub attempts: u32,
    pub verified: bool,
}

pub struct PhoneAuthStore {
    // In production: replace with Redis with TTL
    otps: Mutex<HashMap<String, OtpEntry>>,
    max_attempts: u32,
    otp_ttl_seconds: i64,
}

impl PhoneAuthStore {
    pub fn new() -> Self {
        Self {
            otps: Mutex::new(HashMap::new()),
            max_attempts: 5,
            otp_ttl_seconds: 300, // 5 minutes
        }
    }

    /// Normalize phone number to E.164 format
    pub fn normalize_phone(&self, phone: &str) -> String {
        let cleaned: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
        if cleaned.starts_with("0") {
            // Assume US/CA if no country code (in production, derive from locale)
            format!("+1{}", &cleaned[1..])
        } else if cleaned.starts_with("1") && cleaned.len() == 11 {
            format!("+{}", cleaned)
        } else if cleaned.starts_with("+") {
            cleaned
        } else {
            format!("+{}", cleaned)
        }
    }

    /// Generate and store a new OTP code for the given phone number
    pub fn generate_otp(&self, phone: &str) -> Result<String, PhoneAuthError> {
        let normalized = self.normalize_phone(phone);

        // Generate 6-digit code
        let code: String = {
            let mut rng = rand::thread_rng();
            (0..6).map(|_| rng.gen_range(0..10).to_string()).collect()
        };

        let entry = OtpEntry {
            phone: normalized.clone(),
            code: code.clone(),
            expires_at: Utc::now() + chrono::Duration::seconds(self.otp_ttl_seconds),
            attempts: 0,
            verified: false,
        };

        let mut store = self.otps.lock().map_err(|_| PhoneAuthError::StoreError)?;
        store.insert(normalized, entry);

        // In production: send SMS via Twilio here
        log::info!("[DEV] OTP for {}: {}", phone, code);

        Ok(code)
    }

    /// Verify an OTP code for the given phone number
    pub fn verify_otp(&self, phone: &str, code: &str) -> Result<bool, PhoneAuthError> {
        let normalized = self.normalize_phone(phone);
        let mut store = self.otps.lock().map_err(|_| PhoneAuthError::StoreError)?;

        let entry = store.get_mut(&normalized).ok_or(PhoneAuthError::NoOtpFound)?;

        // Check expiry
        if Utc::now() > entry.expires_at {
            store.remove(&normalized);
            return Err(PhoneAuthError::OtpExpired);
        }

        // Check attempts
        if entry.attempts >= self.max_attempts {
            store.remove(&normalized);
            return Err(PhoneAuthError::TooManyAttempts);
        }

        entry.attempts += 1;

        if entry.code == code {
            entry.verified = true;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Check if a phone number has been verified (used during signup)
    pub fn is_verified(&self, phone: &str) -> bool {
        let normalized = self.normalize_phone(phone);
        if let Ok(store) = self.otps.lock() {
            store.get(&normalized).map(|e| e.verified).unwrap_or(false)
        } else {
            false
        }
    }
}

#[derive(Debug)]
pub enum PhoneAuthError {
    NoOtpFound,
    OtpExpired,
    TooManyAttempts,
    StoreError,
}

impl std::fmt::Display for PhoneAuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PhoneAuthError::NoOtpFound => write!(f, "No OTP found for this phone number"),
            PhoneAuthError::OtpExpired => write!(f, "OTP has expired"),
            PhoneAuthError::TooManyAttempts => write!(f, "Too many verification attempts"),
            PhoneAuthError::StoreError => write!(f, "Internal store error"),
        }
    }
}
