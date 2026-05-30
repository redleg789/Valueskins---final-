//! Trust Service
//!
//! Multi-dimensional trust scoring engine.
//! Not a simple "blue check" — weighted scoring across identity, behavior,
//! payment, history, collaboration, reputation, dispute, and network dimensions.
//!
//! Key properties:
//!   - Trust can decrease (any negative event)
//!   - Trust can expire (inactivity decay, document expiry)
//!   - Trust CANNOT transfer (prevents account sales)
//!   - Trust CANNOT be purchased (must be earned)
//!
//! Score range: 0 (UNTRUSTED) to 1000 (ELITE)

pub mod models;
pub mod service;
pub mod calculator;
pub mod handlers;
pub mod badge_engine;
