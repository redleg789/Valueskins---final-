//! Two-Factor Authentication (TOTP)
//!
//! Implements RFC 6238 TOTP for 2FA.
//! Supports enabling, disabling, verification, and recovery codes.

use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

#[derive(Debug, Serialize, Deserialize)]
pub struct TwoFactorSetup {
    pub secret: String,
    pub qr_code_url: String,
    pub recovery_codes: Vec<String>,
}

#[derive(Debug)]
pub enum TwoFactorError {
    InvalidCode,
    InvalidRecoveryCode,
    AlreadyEnabled,
    NotEnabled,
    StoreError,
}

pub struct TwoFactorService;

impl TwoFactorService {
    /// Generate a TOTP secret and recovery codes for initial setup
    pub fn setup(issuer: &str, account_name: &str) -> TwoFactorSetup {
        // Generate 20-byte random secret
        let secret_bytes: [u8; 20] = rand::thread_rng().gen();
        let secret = base32::encode(base32::Alphabet::Rfc4648 { padding: false }, &secret_bytes);

        // Generate 8 recovery codes
        let recovery_codes: Vec<String> = (0..8)
            .map(|_| {
                let code: u64 = rand::thread_rng().gen_range(100000000000..999999999999);
                code.to_string()
            })
            .collect();

        let qr_url = format!(
            "otpauth://totp/{}:{}?secret={}&issuer={}&algorithm=SHA1&digits=6&period=30",
            urlencoding::encode(issuer),
            urlencoding::encode(account_name),
            secret,
            urlencoding::encode(issuer),
        );

        TwoFactorSetup {
            secret,
            qr_code_url: qr_url,
            recovery_codes,
        }
    }

    /// Verify a TOTP code against a secret
    /// Implements RFC 6238 with a 30-second window and +/- 1 step tolerance
    pub fn verify_totp(secret: &str, code: &str, tolerance: i64) -> bool {
        let code_num: u64 = match code.parse() {
            Ok(c) => c,
            Err(_) => return false,
        };

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        // Check current and adjacent time steps
        for offset in -tolerance..=tolerance {
            let time_step = (now / 30) + offset;
            if let Ok(expected) = generate_totp(secret, time_step) {
                if expected == code_num {
                    return true;
                }
            }
        }

        false
    }

    /// Hash a recovery code for storage
    pub fn hash_recovery_code(code: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(code.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Verify a recovery code against a list of hashed codes
    pub fn verify_recovery_code(code: &str, stored_hashes: &[String]) -> bool {
        let hashed = Self::hash_recovery_code(code);
        stored_hashes.contains(&hashed)
    }
}

/// Generate a TOTP code using SHA-1 (RFC 4226 / RFC 6238)
fn generate_totp(secret: &str, time_step: i64) -> Result<u64, ()> {
    let key = base32::decode(base32::Alphabet::Rfc4648 { padding: false }, secret)
        .ok_or(())?;

    let msg = time_step.to_be_bytes();

    // HMAC-SHA1
    use hmac::{Hmac, Mac};
    type HmacSha1 = Hmac<sha1::Sha1>;

    let mut mac = HmacSha1::new_from_slice(&key).map_err(|_| ())?;
    mac.update(&msg);
    let result = mac.finalize().into_bytes();

    // Dynamic truncation
    let offset = (result[19] & 0xf) as usize;
    let code = ((result[offset] & 0x7f) as u32) << 24
        | (result[offset + 1] as u32) << 16
        | (result[offset + 2] as u32) << 8
        | (result[offset + 3] as u32);

    Ok((code % 1000000) as u64)
}
