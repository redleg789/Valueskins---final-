//! Contract Generation & E-Signature Service
//!
//! Auto-generates contracts when an offer round is accepted.
//! SHA-256 content hashing for tamper evidence.
//! Both-party e-signature required before deal proceeds.
//! Revision cap enforcement, kill-fee triggers.

pub mod models;
pub mod service;
pub mod handlers;
