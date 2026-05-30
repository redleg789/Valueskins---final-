//! Webhook Signature Validation Middleware
//!
//! Verifies HMAC-SHA256 signatures on inbound webhooks (Stripe, Instagram, etc.).
//! Without this, anyone can spoof payment confirmations or platform events.
//!
//! Each webhook provider sends a signature header:
//!   Stripe: `Stripe-Signature`
//!   Internal: `X-Valueskins-Signature`
//!
//! The middleware computes HMAC(secret, raw_body) and compares in constant time.

use actix_web::{HttpRequest, web::Bytes};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use subtle::ConstantTimeEq;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug)]
pub enum WebhookError {
    MissingSignature,
    InvalidSignature,
    InvalidPayload,
}

impl std::fmt::Display for WebhookError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WebhookError::MissingSignature => write!(f, "Missing webhook signature header"),
            WebhookError::InvalidSignature => write!(f, "Invalid webhook signature"),
            WebhookError::InvalidPayload => write!(f, "Invalid webhook payload"),
        }
    }
}

/// Verify a Stripe webhook signature.
/// Stripe sends: `Stripe-Signature: t=timestamp,v1=signature`
pub fn verify_stripe_signature(
    req: &HttpRequest,
    body: &Bytes,
    secret: &str,
) -> Result<(), WebhookError> {
    let sig_header = req
        .headers()
        .get("Stripe-Signature")
        .and_then(|v| v.to_str().ok())
        .ok_or(WebhookError::MissingSignature)?;

    // Parse t= and v1= from header
    let mut timestamp = "";
    let mut signature = "";
    for part in sig_header.split(',') {
        let part = part.trim();
        if let Some(t) = part.strip_prefix("t=") {
            timestamp = t;
        } else if let Some(v) = part.strip_prefix("v1=") {
            signature = v;
        }
    }

    if timestamp.is_empty() || signature.is_empty() {
        return Err(WebhookError::InvalidSignature);
    }

    // Stripe signs: "{timestamp}.{body}"
    let signed_payload = format!("{}.{}", timestamp, std::str::from_utf8(body).map_err(|_| WebhookError::InvalidPayload)?);

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|_| WebhookError::InvalidSignature)?;
    mac.update(signed_payload.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());

    // Constant-time comparison to prevent timing attacks
    if expected.as_bytes().ct_eq(signature.as_bytes()).into() {
        Ok(())
    } else {
        Err(WebhookError::InvalidSignature)
    }
}

/// Verify an internal ValuSkins webhook signature.
/// Header: `X-Valueskins-Signature: sha256=<hex>`
pub fn verify_internal_signature(
    req: &HttpRequest,
    body: &Bytes,
    secret: &str,
) -> Result<(), WebhookError> {
    let sig_header = req
        .headers()
        .get("X-Valueskins-Signature")
        .and_then(|v| v.to_str().ok())
        .ok_or(WebhookError::MissingSignature)?;

    let signature = sig_header
        .strip_prefix("sha256=")
        .ok_or(WebhookError::InvalidSignature)?;

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|_| WebhookError::InvalidSignature)?;
    mac.update(body);
    let expected = hex::encode(mac.finalize().into_bytes());

    if expected.as_bytes().ct_eq(signature.as_bytes()).into() {
        Ok(())
    } else {
        Err(WebhookError::InvalidSignature)
    }
}
