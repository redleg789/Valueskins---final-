//! Pricing Benchmark Service
//!
//! Computes and serves market pricing data (p25/median/p75) from completed deals.
//! Deterministic: same inputs always produce same outputs.
//! Version-stamped: old benchmark versions remain queryable forever.

pub mod models;
pub mod service;
pub mod handlers;
