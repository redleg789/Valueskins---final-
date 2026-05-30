//! Guardian Service
//!
//! Manages guardian relationships between minors and their parents/guardians.
//! Handles invite flow, consent, permission delegation, transfer on age-up,
//! revocation, and dispute resolution.
//!
//! State machine: guardian_relationship_state with 12 explicit states.
//! No manual bypass of guardian permissions — enforced at service layer.

pub mod models;
pub mod service;
pub mod handlers;
pub mod permissions;
pub mod transfer;
