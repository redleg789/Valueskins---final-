//! Data Retention Worker — enforces per-table retention policies.
//!
//! Reads `data_retention_policies` table and deletes rows older than
//! the configured retention period. Runs as part of cleanup_worker
//! or standalone. Uses batched deletes to avoid long-running locks.

use sqlx::PgPool;

const BATCH_SIZE: i64 = 5000;

/// Execute retention cleanup for all configured tables.
/// Returns total rows deleted across all tables.
pub async fn enforce_all(pool: &PgPool) -> Result<u64, sqlx::Error> {
    let policies: Vec<(String, i32, String)> = sqlx::query_as(
        "SELECT table_name, retention_days, cleanup_column
         FROM data_retention_policies
         ORDER BY table_name"
    )
    .fetch_all(pool)
    .await?;

    let mut total_deleted: u64 = 0;

    for (table_name, retention_days, cleanup_column) in &policies {
        match enforce_single(pool, table_name, *retention_days, cleanup_column).await {
            Ok(deleted) => {
                if deleted > 0 {
                    tracing::info!(
                        table = table_name.as_str(),
                        deleted = deleted,
                        "Data retention cleanup"
                    );
                    // Update last_cleanup_at and rows_deleted
                    sqlx::query(
                        "UPDATE data_retention_policies
                         SET last_cleanup_at = NOW(), rows_deleted = rows_deleted + $2
                         WHERE table_name = $1"
                    )
                    .bind(table_name)
                    .bind(deleted as i64)
                    .execute(pool)
                    .await?;
                }
                total_deleted += deleted;
            }
            Err(e) => {
                tracing::error!(
                    table = table_name.as_str(),
                    error = %e,
                    "Data retention cleanup failed for table"
                );
                // Continue with other tables — one failure shouldn't block all
            }
        }
    }

    Ok(total_deleted)
}

/// Delete expired rows from a single table in batches.
/// Uses dynamic SQL with whitelisted table/column names.
async fn enforce_single(
    pool: &PgPool,
    table_name: &str,
    retention_days: i32,
    cleanup_column: &str,
) -> Result<u64, sqlx::Error> {
    // Whitelist: only allow known table names to prevent SQL injection.
    // The table names come from our own data_retention_policies table,
    // but defense-in-depth requires we validate anyway.
    if !is_valid_identifier(table_name) || !is_valid_identifier(cleanup_column) {
        tracing::error!(
            table = table_name,
            column = cleanup_column,
            "Invalid identifier in retention policy — skipping"
        );
        return Ok(0);
    }

    let mut total_deleted: u64 = 0;

    // Batched delete loop to avoid holding locks on millions of rows
    loop {
        let query = format!(
            "DELETE FROM {table} WHERE ctid IN (
                SELECT ctid FROM {table}
                WHERE {column} < NOW() - INTERVAL '{days} days'
                LIMIT {limit}
            )",
            table = table_name,
            column = cleanup_column,
            days = retention_days,
            limit = BATCH_SIZE,
        );

        let result = sqlx::query(&query).execute(pool).await?;
        let deleted = result.rows_affected();
        total_deleted += deleted;

        if deleted < BATCH_SIZE as u64 {
            break;
        }

        // Yield between batches to avoid starving other queries
        tokio::task::yield_now().await;
    }

    Ok(total_deleted)
}

/// Validates that an identifier contains only safe characters (alphanumeric + underscore).
fn is_valid_identifier(s: &str) -> bool {
    !s.is_empty() && s.len() <= 63 && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}
