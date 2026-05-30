# AWS Backup + Disaster Recovery

resource "aws_backup_vault" "main" {
  name = "valueskins-${var.environment}"
}

# Backup Plan
resource "aws_backup_plan" "daily" {
  name = "valueskins-daily-${var.environment}"

  rule {
    rule_name         = "daily_backup"
    target_backup_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 5 ? * * *)"  # 5 AM UTC daily
    start_window      = 60
    completion_window = 120

    lifecycle {
      delete_after = 30
      cold_storage_after = 7
    }

    recovery_point_tags = {
      Environment = var.environment
      Type        = "Daily"
    }
  }

  rule {
    rule_name         = "weekly_backup"
    target_backup_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 6 ? * 1 *)"  # Every Monday 6 AM UTC
    start_window      = 60
    completion_window = 180

    lifecycle {
      delete_after = 90
      cold_storage_after = 30
    }

    recovery_point_tags = {
      Environment = var.environment
      Type        = "Weekly"
    }
  }
}

# RDS Backup Selection
resource "aws_backup_selection" "rds" {
  name            = "rds-backup"
  plan_id         = aws_backup_plan.daily.id
  iam_role_arn    = aws_iam_role.backup.arn
  type            = "RDS"
  resources       = ["arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:db:${var.rds_instance_id}"]
}

# EBS Snapshot Selection
resource "aws_backup_selection" "ebs" {
  name       = "ebs-backup"
  plan_id    = aws_backup_plan.daily.id
  iam_role_arn = aws_iam_role.backup.arn
  type       = "EBS"

  selection_tag {
    type   = "STRINGEQUALS"
    key    = "Backup"
    value  = "true"
  }
}

# S3 Backup Selection (using S3 replication + versioning)
resource "aws_s3_bucket_replication_configuration" "backups" {
  depends_on = [aws_s3_bucket_versioning.backups]

  bucket = var.s3_bucket_id
  role   = aws_iam_role.s3_replication.arn

  rule {
    id     = "replicate-backups"
    status = "Enabled"

    destination {
      bucket       = "arn:aws:s3:::valueskins-backups-${var.dr_region}"
      replication_time {
        status = "Enabled"
        time {
          minutes = 15
        }
      }
      storage_class = "GLACIER"
    }
  }
}

# DynamoDB Backup
resource "aws_dynamodb_backup" "sessions" {
  table_name = "sessions-${var.environment}"
  backup_name = "sessions-backup-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
}

# Point-in-time recovery for RDS
resource "aws_db_instance_backup_retention" "main" {
  db_instance_identifier = var.rds_instance_id
  backup_retention_period = 35
  backup_window          = "03:00-04:00"
  preferred_backup_window = "03:00-04:00"
  copy_tags_to_snapshot  = true
  multi_az               = true
}

# Cross-region replication for disaster recovery
resource "aws_db_instance_read_replica" "dr" {
  identifier          = "${var.rds_instance_id}-dr"
  replicate_source_db = var.rds_instance_id
  availability_zone   = var.dr_zone
  publicly_accessible = false
  skip_final_snapshot = false
  auto_minor_version_upgrade = false

  performance_insights_enabled = true
}

# SNS notification for backup completion
resource "aws_backup_vault_notifications" "main" {
  backup_vault_name   = aws_backup_vault.main.name
  sns_topic_arn       = var.sns_topic_arn
  backup_vault_events = ["BACKUP_JOB_SUCCESSFUL", "BACKUP_JOB_FAILED", "RESTORE_JOB_SUCCESSFUL", "RESTORE_JOB_FAILED"]
}

# Backup Reporting
resource "aws_backup_report_plan" "main" {
  name            = "valueskins-compliance-report"
  format          = "JSON"
  report_s3_bucket = var.reports_bucket
  report_s3_key_prefix = "backup-reports/"

  report_setting {
    report_template = "RESOURCE_COMPLIANCE_REPORT"
  }

  deployment_status = "CREATE_IN_PROGRESS"
}

# IAM Roles
resource "aws_iam_role" "backup" {
  name = "aws-backup-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "backup.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "backup_restore" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

resource "aws_iam_role" "s3_replication" {
  name = "s3-replication-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "s3.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "s3_replication" {
  name   = "s3-replication-policy"
  role   = aws_iam_role.s3_replication.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::${var.s3_bucket_id}"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl"
        ]
        Resource = "arn:aws:s3:::${var.s3_bucket_id}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete"
        ]
        Resource = "arn:aws:s3:::valueskins-backups-${var.dr_region}/*"
      }
    ]
  })
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = var.s3_bucket_id

  versioning_configuration {
    status = "Enabled"
  }
}

data "aws_caller_identity" "current" {}

output "backup_vault_arn" {
  value = aws_backup_vault.main.arn
}

output "backup_plan_arn" {
  value = aws_backup_plan.daily.arn
}
