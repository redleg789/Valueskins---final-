//! Identity Service
//!
//! Handles age verification, identity document processing, KYC flow,
//! liveness checks, and selfie verification.
//!
//! State machine driven: user_age_verification_state with 16 explicit states.
//! No booleans. Every transition is validated.
//!
//! Threat model:
//!   - Fake documents: AI forgery detection, metadata analysis
//!   - Stolen identities: document reuse detection, liveness checks
//!   - Age forgery: cross-reference declared DOB with document DOB
//!   - Synthetic identities: pattern detection across platform

pub mod models;
pub mod handlers;
pub mod age_verification;
pub mod document_verification;
pub mod kyc;
