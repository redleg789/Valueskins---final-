//! Payment and Escrow Service
//!
//! Handles fund flow with safety:
//! - Stripe for tokenization (PCI-DSS scope zero)
//! - Escrow holds funds until conditions met
//! - Idempotent payment API (no double-charges)
//! - Immutable audit log of all transactions
//! - Platform fee engine (provider-agnostic, default $1.50 flat)

pub mod escrow;
pub mod idempotency;
pub mod stripe_integration;
pub mod audit_log;
pub mod fee_engine;
