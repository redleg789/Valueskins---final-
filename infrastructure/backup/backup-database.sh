#!/usr/bin/env bash
# =============================================================================
# Valueskins Database Backup Script
# =============================================================================
# Usage: ./backup-database.sh [daily|weekly|monthly]
#
# Performs a full pg_dump, compresses with gzip, uploads to S3.
# Designed to run as a Kubernetes CronJob or local cron.
#
# Required environment variables:
#   DATABASE_URL       — PostgreSQL connection string
#   S3_BACKUP_BUCKET   — S3 bucket name (e.g., valueskins-db-backups)
#   AWS_REGION         — AWS region (default: us-east-1)
#
# Optional:
#   BACKUP_RETENTION_DAYS  — Days to keep old backups (default: 30)
#   SLACK_WEBHOOK_URL      — Slack webhook for notifications
# =============================================================================

set -euo pipefail

BACKUP_TYPE="${1:-daily}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="valueskins_${BACKUP_TYPE}_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Validate required env vars
for var in DATABASE_URL S3_BACKUP_BUCKET; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: ${var} is not set"
    exit 1
  fi
done

echo "[$(date)] Starting ${BACKUP_TYPE} backup..."

# Perform backup with compression
pg_dump "${DATABASE_URL}" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --format=plain \
  | gzip -9 > "/tmp/${BACKUP_FILE}"

BACKUP_SIZE=$(du -h "/tmp/${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Upload to S3
aws s3 cp "/tmp/${BACKUP_FILE}" \
  "s3://${S3_BACKUP_BUCKET}/${BACKUP_TYPE}/${BACKUP_FILE}" \
  --region "${AWS_REGION}" \
  --storage-class STANDARD_IA

echo "[$(date)] Uploaded to s3://${S3_BACKUP_BUCKET}/${BACKUP_TYPE}/${BACKUP_FILE}"

# Clean up local file
rm -f "/tmp/${BACKUP_FILE}"

# Prune old backups
echo "[$(date)] Pruning backups older than ${RETENTION_DAYS} days..."
CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +"%Y-%m-%d" 2>/dev/null || date -v-${RETENTION_DAYS}d +"%Y-%m-%d")
aws s3 ls "s3://${S3_BACKUP_BUCKET}/${BACKUP_TYPE}/" \
  --region "${AWS_REGION}" \
  | while read -r line; do
      FILE_DATE=$(echo "${line}" | awk '{print $1}')
      FILE_NAME=$(echo "${line}" | awk '{print $4}')
      if [[ "${FILE_DATE}" < "${CUTOFF_DATE}" ]] && [[ -n "${FILE_NAME}" ]]; then
        aws s3 rm "s3://${S3_BACKUP_BUCKET}/${BACKUP_TYPE}/${FILE_NAME}" \
          --region "${AWS_REGION}"
        echo "  Pruned: ${FILE_NAME}"
      fi
    done

# Notify Slack (optional)
if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
  curl -s -X POST "${SLACK_WEBHOOK_URL}" \
    -H 'Content-type: application/json' \
    -d "{\"text\":\"DB Backup complete: ${BACKUP_TYPE} | ${BACKUP_FILE} (${BACKUP_SIZE})\"}" \
    > /dev/null
fi

echo "[$(date)] Backup pipeline complete."
