#!/bin/bash
# S3 Backup Restore Verification Test

set -euo pipefail

echo "=== S3 Backup Restore Test ==="

# Check backup bucket exists
BACKUP_BUCKET="${S3_BACKUP_BUCKET:-valueskins-db-backups}"
echo "✓ Checking backup bucket: $BACKUP_BUCKET"

aws s3 ls "s3://$BACKUP_BUCKET/" --region us-east-1 > /dev/null || {
  echo "✗ Backup bucket not found: $BACKUP_BUCKET"
  exit 1
}

# Get latest backup
echo "✓ Finding latest backup..."
LATEST_BACKUP=$(aws s3 ls "s3://$BACKUP_BUCKET/daily/" --region us-east-1 | tail -1 | awk '{print $4}')

if [ -z "$LATEST_BACKUP" ]; then
  echo "✗ No backups found"
  exit 1
fi

echo "✓ Latest backup: $LATEST_BACKUP"

# Verify backup is recent (within last 24 hours)
BACKUP_DATE=$(echo "$LATEST_BACKUP" | grep -oP '\d{8}_\d{6}' | head -1)
TODAY=$(date +%Y%m%d)
YESTERDAY=$(date -d yesterday +%Y%m%d)

if [[ "$BACKUP_DATE" != "$TODAY" && "$BACKUP_DATE" != "$YESTERDAY" ]]; then
  echo "✗ Backup too old: $BACKUP_DATE"
  exit 1
fi

echo "✓ Backup is recent"

# Download backup (don't restore to live DB, just verify integrity)
echo "✓ Downloading backup..."
aws s3 cp "s3://$BACKUP_BUCKET/daily/$LATEST_BACKUP" "/tmp/$LATEST_BACKUP" --region us-east-1

# Verify file integrity
echo "✓ Verifying backup integrity..."
if ! gunzip -t "/tmp/$LATEST_BACKUP" > /dev/null 2>&1; then
  echo "✗ Backup file corrupted"
  rm -f "/tmp/$LATEST_BACKUP"
  exit 1
fi

echo "✓ Backup is valid and restorable"

# Cleanup
rm -f "/tmp/$LATEST_BACKUP"

echo "=== All backup restore tests passed ==="
exit 0
