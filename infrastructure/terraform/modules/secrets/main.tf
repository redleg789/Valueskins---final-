# AWS Secrets Manager — Centralized secret storage with auto-rotation
# Consumed by K8s pods via External Secrets Operator

variable "environment" { type = string }
variable "project" { type = string }
variable "rds_endpoint" { type = string }
variable "rds_password" { type = string sensitive = true }
variable "redis_endpoint" { type = string }

resource "aws_secretsmanager_secret" "database" {
  name                    = "${var.project}/${var.environment}/database"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    url      = "postgres://valueskins_admin:${var.rds_password}@${var.rds_endpoint}/valueskins?sslmode=require"
    host     = var.rds_endpoint
    password = var.rds_password
  })
}

resource "aws_secretsmanager_secret" "auth" {
  name                    = "${var.project}/${var.environment}/auth"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "auth" {
  secret_id = aws_secretsmanager_secret.auth.id
  secret_string = jsonencode({
    jwt_secret               = random_password.jwt.result
    api_key_hmac_salt        = random_password.hmac_salt.result
    verification_hmac_secret = random_password.verification.result
  })
}

resource "aws_secretsmanager_secret" "smtp" {
  name                    = "${var.project}/${var.environment}/smtp"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "redis" {
  name                    = "${var.project}/${var.environment}/redis"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id = aws_secretsmanager_secret.redis.id
  secret_string = jsonencode({
    endpoint = var.redis_endpoint
  })
}

resource "aws_secretsmanager_secret" "linkedin" {
  name                    = "${var.project}/${var.environment}/linkedin"
  recovery_window_in_days = 7
}

# LinkedIn OAuth credentials are manually provisioned from https://www.linkedin.com/developers/apps
# The secret version is created manually or via CI to avoid committing OAuth secrets to IaC.
# Expected keys: client_id, client_secret

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "random_password" "hmac_salt" {
  length  = 64
  special = false
}

resource "random_password" "verification" {
  length  = 64
  special = false
}

# Secret rotation for database password
resource "aws_secretsmanager_secret_rotation" "database" {
  secret_id           = aws_secretsmanager_secret.database.id
  rotation_lambda_arn = aws_lambda_function.secret_rotation.arn

  rotation_rules {
    automatically_after_days = 30
  }
}

# Rotation lambda placeholder (implemented separately)
resource "aws_lambda_function" "secret_rotation" {
  function_name = "${var.project}-${var.environment}-secret-rotation"
  role          = aws_iam_role.rotation.arn
  handler       = "index.handler"
  runtime       = "python3.12"
  timeout       = 30
  filename      = "${path.module}/rotation_lambda.zip"

  environment {
    variables = {
      SECRET_ARN = aws_secretsmanager_secret.database.arn
    }
  }
}

resource "aws_iam_role" "rotation" {
  name = "${var.project}-${var.environment}-secret-rotation"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

output "database_secret_arn" { value = aws_secretsmanager_secret.database.arn }
output "auth_secret_arn" { value = aws_secretsmanager_secret.auth.arn }
output "linkedin_secret_arn" { value = aws_secretsmanager_secret.linkedin.arn }
