# PostgreSQL RDS - Optimized for 100K users
# Production configuration with read replicas

terraform {
  required_version = ">= 1.0"
}

# Primary Instance - write operations
resource "aws_db_instance" "primary" {
  identifier = "valueskins-prod-primary"
  
  # Upgrade to handle more connections + queries
  instance_class    = "db.r6g.4xlarge"     # 16 vCPU, 128GB RAM
  engine          = "postgres"
  engine_version = "16.3"
  allocated_storage = 1000              # 1TB
  storage_type     = "gp3"
  storage_iops    = 6000               # Higher IOPS
  throughput      = 500
  
  # Multi-AZ mandatory for production
  multi_az = true
  
  # Connection
  name                   = var.database_name
  username              = var.database_user
  password              = var.database_password
  port                  = 5432
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  # Performance tuning
  maintec = "default"
  backup_retention_period = 30
  backup_window         = "03:00-04:00"
  maintenance_window    = "sun:04:00-sun:05:00"
  skip_final_snapshot   = false
  final_snapshot_identifier = "valueskins-prod-final"
  
  # Encryption
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn
  
  # Performance insights
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  
  # Connection pooling optimization
  # Allow more connections via PgBouncer
  max_connections = 500               # Increased from default
  
  # Monitor
  monitoring_interval = 30
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  
  tags = var.common_tags
}

# Read Replica 1 - us-east-1
resource "aws_db_instance" "read_replica_1" {
  identifier = "valueskins-prod-replica-1"
  
  instance_class    = "db.r6g.4xlarge"     # Same as primary for read performance
  engine          = "postgres"
  engine_version = "16.3"
  allocated_storage = 1000
  storage_type     = "gp3"
  storage_iops    = 6000
  
  replicate_source_db = aws_db_instance.primary.id
  
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn
  
  tags = merge(var.common_tags, { replica = "1" })
}

# Read Replica 2 - us-west-2 (cross-region for disaster recovery)
resource "aws_db_instance" "read_replica_2" {
  identifier = "valueskins-prod-replica-2"
  
  instance_class    = "db.r6g.4xlarge"
  engine          = "postgres"
  engine_version = "16.3"
  allocated_storage = 1000
  storage_type     = "gp3"
  storage_iops    = 6000
  
  # Cross-region replicate
  replicate_source_db = aws_db_instance.primary.id
  
  # Use alternate region subnet
  db_subnet_group_name   = aws_db_subnet_group.main_2.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn
  
  tags = merge(var.common_tags, { replica = "2", region = "us-west-2" })
}

# Subnet Group - primary region
resource "aws_db_subnet_group" "main" {
  name = "valueskins-prod-subnet-group"
  subnet_ids = var.private_subnet_ids
  tags = var.common_tags
}

# Subnet Group - secondary region
resource "aws_db_subnet_group" "main_2" {
  name = "valueskins-prod-subnet-group-usw2"
  subnet_ids = var.private_subnet_ids_2
  tags = var.common_tags
}

# Security Group
resource "aws_security_group" "rds" {
  name        = "valueskins-prod-rds"
  description = "Security group for RDS instances"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol       = "tcp"
    cidr_blocks    = [var.vpc_cidr]
    description   = "PostgreSQL from VPC"
  }
  
  egress {
    from_port       = 0
    to_port         = 0
    protocol       = "-1"
    cidr_blocks    = ["0.0.0.0/0"]
  }
  
  tags = var.common_tags
}

# KMS Key
resource "aws_kms_key" "rds" {
  description            = "KMS key for RDS encryption"
  deletion_window_days = 10
  enable_key_rotation   = true
  tags = var.common_tags
}

resource "aws_kms_alias" "rds" {
  name          = "alias/valueskins-prod-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# RDS Monitoring Role
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

# Parameter Group - optimized for 100K users
resource "aws_db_parameter_group" "optimized" {
  name = "valueskins-prod-params"
  
  family = "postgres16"
  
  # Connection settings
  parameter = [
    {
      name  = "shared_buffers"
      value = "32768"                    # 128GB of 128GB RAM
    },
    {
      name  = "effective_cache_size"
      value = "98304"                    # Assume 384GB cache
    },
    {
      name  = "maintenance_work_mem"
      value = "2048"
    },
    {
      name  = "checkpoint_completion_target"
      value = "0.9"
    },
    {
      name  = "wal_buffers"
      value = "16"
    },
    {
      name  = "default_statistics_target"
      value = "500"
    },
    {
      name  = "random_page_cost"
      value = "1.1"
    },
    {
      name  = "effective_io_concurrency"
      value = "200"
    },
    {
      name  = "max_connections"
      value = "500"
    },
    {
      name  = "max_worker_processes"
      value = "16"
    },
    {
      name  = "max_parallel_workers_per_query"
      value = "8"
    },
    {
      name  = "max_parallel_workers"
      value = "16"
    },
    {
      name  = "max_parallel_maintenance_workers"
      value = "8"
    },
    {
      name  = "idle_in_transaction_session_timeout"
      value = "60000"
    },
    {
      name  = "lock_timeout"
      value = "30000"
    },
    {
      name  = "statement_timeout"
      value = "30000"
    },
    {
      name  = "track_activity_query_size"
      value = "8192"
    },
    {
      name  = "track_counts"
      value = "on"
    },
    {
      name  = "track_io_timing"
      value = "on"
    },
    {
      name  = "track_functions"
      value = "pl"
    }
  ]
}

# Outputs
output "primary_endpoint" {
  value = aws_db_instance.primary.endpoint
}

output "read_replica_1_endpoint" {
  value = aws_db_instance.read_replica_1.endpoint
}

output "read_replica_2_endpoint" {
  value = aws_db_instance.read_replica_2.endpoint
}