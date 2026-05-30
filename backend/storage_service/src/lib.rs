//! Media Upload Service
//! S3-backed file storage for creator deliverables
//! Uses presigned URLs - frontend uploads directly to S3

pub mod s3;
pub mod validators;
