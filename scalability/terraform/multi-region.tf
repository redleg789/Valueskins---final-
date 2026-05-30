# Multi-region Database Setup for Global Scale
# Primary: us-east-1, Secondary: us-west-2, Tertiary: eu-west-1

terraform {
  required_version = ">= 1.0"
}

# Primary Region (us-east-1)
resource "aws_db_instance" "primary" {
  identifier = "valueskins-primary"
  
  instance_class    = "db.r6g.4xlarge"
  engine          = "postgres"
  engine_version = "16.3"
  allocated_storage = 1000
  storage_type     = "gp3"
  storage_iops    = 6000
  
  multi_az = true
  
  name                   = "valueskins"
  username              = var.database_user
  password              = var.database_password
  port                  = 5432
  db_subnet_group_name   = aws_db_subnet_group.primary.name
  vpc_security_group_ids = [aws_security_group.database.id]
  
  storage_encrypted = true
  kms_key_id        = aws_kms_key.database.arn
  
  backup_retention_period = 30
  backup_window         = "03:00-04:00"
  maintenance_window    = "sun:04:00-sun:05:00"
  skip_final_snapshot   = false
  
  # Monitoring
  monitoring_interval = 30
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  
  tags = merge(var.common_tags, { region = "us-east-1", role = "primary" })
}

# Read Replica in us-west-2
resource "aws_db_instance" "read_replica_uswest" {
  identifier = "valueskins-read-uswest"
  
  instance_class    = "db.r6g.4xlarge"
  engine          = "postgres"
  engine_version = "16.3"
  allocated_storage = 1000
  storage_type     = "gp3"
  storage_iops    = 6000
  
  replicate_source_db = aws_db_instance.primary.arn
  
  db_subnet_group_name   = aws_db_subnet_group.uswest.name
  vpc_security_group_ids = [aws_security_group.database.id]
  
  storage_encrypted = true
  kms_key_id        = aws_kms_key.database.arn
  
  # Cross-region: needs to be in different region
  provider = aws.uswest
  
  tags = merge(var.common_tags, { region = "us-west-2", role = "read-replica" })
}

# Read Replica in eu-west-1 (for European users)
resource "aws_db_instance" "read_replica_eu" {
  identifier = "valueskins-read-eu"
  
  instance_class    = "db.r6g.4xlarge"
  engine          = "postgres"
  engine_version = "16.3"
  allocated_storage = 1000
  storage_type     = "gp3"
  storage_iops    = 6000
  
  replicate_source_db = aws_db_instance.primary.arn
  
  db_subnet_group_name   = aws_db_subnet_group.eu.name
  vpc_security_group_ids = [aws_security_group.database.id]
  
  storage_encrypted = true
  kms_key_id        = aws_kms_key.database.arn
  
  # Cross-region
  provider = aws.eu
  
  tags = merge(var.common_tags, { region = "eu-west-1", role = "read-replica" })
}

# Subnet Groups
resource "aws_db_subnet_group" "primary" {
  name = "valueskins-primary-subnet"
  subnet_ids = var.primary_subnet_ids
}

resource "aws_db_subnet_group" "uswest" {
  name = "valueskins-uswest-subnet"
  subnet_ids = var.uswest_subnet_ids
}

resource "aws_db_subnet_group" "eu" {
  name = "valueskins-eu-subnet"
  subnet_ids = var.eu_subnet_ids
}

# Security Groups
resource "aws_security_group" "database" {
  name        = "valueskins-database"
  description = "Database security group"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol       = "tcp"
    cidr_blocks    = [var.vpc_cidr]
  }
  
  tags = var.common_tags
}

# IAM Role for RDS Monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "valueskins-rds-monitoring"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "monitoring.rds.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonRDSEnhancedMonitoringRole"
}

# KMS Key
resource "aws_kms_key" "database" {
  description            = "KMS key for database encryption"
  deletion_window_days = 10
  enable_key_rotation   = true
  
  tags = var.common_tags
}

resource "aws_kms_alias" "database" {
  name          = "alias/valueskins-database"
  target_key_id = aws_kms_key.database.key_id
}

# Outputs
output "primary_endpoint" {
  description = "Primary region endpoint"
  value       = aws_db_instance.primary.endpoint
}

output "uswest_endpoint" {
  description = "US West read replica endpoint"
  value       = aws_db_instance.read_replica_uswest.endpoint
}

output "eu_endpoint" {
  description = "EU read replica endpoint"
  value       = aws_db_instance.read_replica_eu.endpoint
}

output "primary_region" {
  value = "us-east-1"
}

output "read_regions" {
  value = ["us-west-2", "eu-west-1"]
}