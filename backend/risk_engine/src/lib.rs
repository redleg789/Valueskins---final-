//! Risk Engine
//!
//! Real-time risk scoring and fraud detection.
//! Monitors ALL events across the platform and assigns risk scores.
//! Triggers alerts, account freezes, and moderation cases.
//!
//! Detection capabilities:
//!   - Account takeover attempts
//!   - Bot farms / Sybil attacks
//!   - Payment fraud / chargeback patterns
//!   - Collusion detection
//!   - Document forgery
//!   - Deepfakes
//!   - Identity laundering
//!   - Insider abuse

pub mod models;
pub mod service;
pub mod handlers;
pub mod detectors;
