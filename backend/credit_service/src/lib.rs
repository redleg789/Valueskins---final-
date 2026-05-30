//! Creator Credit Line Service
//!
//! Deterministic credit scoring from completed deals, trust scores, and tenure.
//! No money movement — emits events for Meta's payment rail.
//! Idempotent advance draws with auto-repayment on deal completion.

pub mod models;
pub mod service;
pub mod handlers;
