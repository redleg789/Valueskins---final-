# Valueskins Production Infrastructure
# Multi-AZ deployment on AWS for high availability
# All infrastructure defined as code — reproducible across environments

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "valueskins-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-lock"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "valueskins"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Secondary region for disaster recovery
provider "aws" {
  alias  = "dr"
  region = var.dr_region

  default_tags {
    tags = {
      Project     = "valueskins"
      Environment = "${var.environment}-dr"
      ManagedBy   = "terraform"
    }
  }
}

# ── Networking ───────────────────────────────────────────────────────
module "vpc" {
  source = "./modules/vpc"

  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
}

# ── Kubernetes Cluster ───────────────────────────────────────────────
module "eks" {
  source = "./modules/eks"

  environment    = var.environment
  cluster_name   = "${var.project}-${var.environment}"
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  node_min       = var.eks_node_min
  node_max       = var.eks_node_max
  node_instance  = var.eks_node_instance
}

# ── Database (Multi-AZ RDS) ─────────────────────────────────────────
module "rds" {
  source = "./modules/rds"

  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.data_subnet_ids
  instance_class        = var.rds_instance_class
  allocated_storage     = var.rds_storage_gb
  multi_az              = true
  backup_retention_days = var.rds_backup_retention
  db_name               = "valueskins"
  allowed_security_groups = [module.eks.node_security_group_id]
}

# ── Cache (ElastiCache Redis) ────────────────────────────────────────
module "redis" {
  source = "./modules/redis"

  environment    = var.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.data_subnet_ids
  node_type      = var.redis_node_type
  num_cache_nodes = var.redis_num_nodes
  allowed_security_groups = [module.eks.node_security_group_id]
}

# ── Message Queue (MSK Kafka) ───────────────────────────────────────
module "kafka" {
  source = "./modules/kafka"

  environment    = var.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.data_subnet_ids
  broker_count   = var.kafka_broker_count
  instance_type  = var.kafka_instance_type
  allowed_security_groups = [module.eks.node_security_group_id]
}

# ── Secrets Management ───────────────────────────────────────────────
module "secrets" {
  source = "./modules/secrets"

  environment = var.environment
  project     = var.project
  rds_endpoint = module.rds.endpoint
  rds_password = module.rds.master_password
  redis_endpoint = module.redis.endpoint
}

# ── Load Balancer ───────────────────────────────────────────────────────
module "alb" {
  source = "./modules/alb"

  environment     = var.environment
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.public_subnet_ids
  target_group_arn = aws_lb_target_group.backend.arn
}

# ── CDN (CloudFront) ────────────────────────────────────────────────────
module "cdn" {
  source = "./modules/cdn"

  environment       = var.environment
  alb_domain_name   = module.alb.dns_name
  s3_bucket_domain  = aws_s3_bucket.assets.bucket_regional_domain_name
  certificate_arn   = aws_acm_certificate.main.arn
}

# ── Monitoring (CloudWatch + Prometheus + Grafana) ──────────────────────
module "monitoring" {
  source = "./modules/monitoring"

  environment     = var.environment
  aws_region      = var.aws_region
  sns_topic_arn   = aws_sns_topic.alerts.arn
  alert_email     = var.alert_email
  log_group_name  = aws_cloudwatch_log_group.application.name
}

# ── CI/CD (CodeBuild + CodeDeploy + ECR) ────────────────────────────────
module "cicd" {
  source = "./modules/cicd"

  environment = var.environment
}

# ── Backup & Disaster Recovery ──────────────────────────────────────────
module "backup" {
  source = "./modules/backup"

  environment      = var.environment
  aws_region       = var.aws_region
  dr_region        = var.dr_region
  dr_zone          = "${var.dr_region}a"
  rds_instance_id  = module.rds.instance_id
  s3_bucket_id     = aws_s3_bucket.backups.id
  reports_bucket   = aws_s3_bucket.reports.id
  sns_topic_arn    = aws_sns_topic.alerts.arn
}

# ── S3 Assets Bucket ────────────────────────────────────────────────────
resource "aws_s3_bucket" "assets" {
  bucket = "valueskins-assets-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

# ── S3 Backup Bucket ────────────────────────────────────────────────────
resource "aws_s3_bucket" "backups" {
  bucket = "valueskins-backups-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

# ── S3 Reports Bucket ───────────────────────────────────────────────────
resource "aws_s3_bucket" "reports" {
  bucket = "valueskins-reports-${data.aws_caller_identity.current.account_id}"
}

# ── SNS Topic for Alerts ────────────────────────────────────────────────
resource "aws_sns_topic" "alerts" {
  name = "valueskins-alerts-${var.environment}"
}

# ── Target Group for ALB ────────────────────────────────────────────────
resource "aws_lb_target_group" "backend" {
  name        = "valueskins-backend-${var.environment}"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health/live"
    matcher             = "200"
  }
}

# ── CloudWatch Log Group ────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/valueskins/application"
  retention_in_days = 30
}

# ── ACM Certificate ────────────────────────────────────────────────────
resource "aws_acm_certificate" "main" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domain_name}"
  ]

  lifecycle {
    create_before_destroy = true
  }
}

# ── Data Source ────────────────────────────────────────────────────────
data "aws_caller_identity" "current" {}
