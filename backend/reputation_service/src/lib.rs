//! Portable Reputation Passport Service
//!
//! Generates Ed25519-signed, verifiable reputation snapshots.
//! Brands can verify creator history without platform access.
//! Append-only: each export is a new versioned snapshot.

pub mod models;
pub mod service;
pub mod handlers;
pub mod calculator;
