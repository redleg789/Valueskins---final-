# Database Sharding Strategy for 100K+ users
# Shard by user_id modulo for write scaling

terraform {
  required_version = ">= 1.0"
}

# Shard 0 (Primary - handles writes)
resource "aws_db_instance" "shard_0" {
  identifier = "valueskins-shard-0"
  
  instance_class    = "db.r6g.4xlarge"
  engine          = "postgres"
  engine_version = "16.3"
  allocated_storage = 1000
  storage_type     = "gp3"
  storage_iops    = 6000
  
  multi_az = true
  
  name                   = "valueskins_0"
  username              = var.database_user
  password              = var.database_password
  port                  = 5432
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn
  
  # Optimized params
  parameter_group_name = aws_db_parameter_group.optimized.name
  
  tags = merge(var.common_tags, { shard = "0" })
}

# Shard 1
resource "aws_db_instance" "shard_1" {
  identifier = "valueskins-shard-1"
  
  instance_class    = "db.r6g.4xlarge"
  engine          = "postgres"
  engine_version = "16.3"
  allocated_storage = 1000
  storage_type     = "gp3"
  storage_iops    = 6000
  
  replicate_source_db = aws_db_instance.shard_0.id
  
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn
  
  parameter_group_name = aws_db_parameter_group.optimized.name
  
  tags = merge(var.common_tags, { shard = "1" })
}

# Shard 2
resource "aws_db_instance" "shard_2" {
  identifier = "valueskins-shard-2"
  
  instance_class    = "db.r6g.4xlarge"
  engine          = "postgres"
  engine_version = "16.3"
  allocated_storage = 1000
  storage_type     = "gp3"
  storage_iops    = 6000
  
  replicate_source_db = aws_db_instance.shard_0.id
  
  db_subnet_group_name   = aws_db_subnet_group.main_2.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn
  
  parameter_group_name = aws_db_parameter_group.optimized.name
  
  tags = merge(var.common_tags, { shard = "2" })
}

# Shard 3
resource "aws_db_instance" "shard_3" {
  identifier = "valueskins-shard-3"
  
  instance_class    = "db.r6g.4xlarge"
  engine          = "postgres"
  engine_version = "16.3"
  allocated_storage = 1000
  storage_type     = "gp3"
  storage_iops    = 6000
  
  replicate_source_db = aws_db_instance.shard_0.id
  
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn
  
  parameter_group_name = aws_db_parameter_group.optimized.name
  
  tags = merge(var.common_tags, { shard = "3" })
}

# PgBouncer for each shard
resource "aws_instance" "pgbouncer_shard_0" {
  count = 4
  
  ami           = var.pgbouncer_ami
  instance_type = "m7i.large"
  
  subnet_id = var.private_subnet_ids[0]
  
  vpc_security_group_ids = [aws_security_group.pgbouncer.id]
  
  tags = merge(var.common_tags, { shard = "0", replica = count.index })
}

resource "aws_instance" "pgbouncer_shard_1" {
  count = 4
  
  ami           = var.pgbouncer_ami
  instance_type = "m7i.large"
  
  subnet_id = var.private_subnet_ids[1]
  
  vpc_security_group_ids = [aws_security_group.pgbouncer.id]
  
  tags = merge(var.common_tags, { shard = "1", replica = count.index })
}

# Network Load Balancer for PgBouncer
resource "aws_lb" "pgbouncer" {
  name               = "valueskins-pgbouncer"
  internal           = true
  load_balancer_type  = "network"
  
  subnets = var.private_subnet_ids
  
  enable_deletion_protection = false
  
  tags = var.common_tags
}

resource "aws_lb_target_group" "pgbouncer" {
  name     = "valueskins-pgbouncer"
  port     = 5432
  protocol = "TCP"
  
  vpc_id = var.vpc_id
  
  health_check {
    enabled = true
    interval = 10
    port = 6432
    protocol = "TCP"
    healthy_threshold = 2
    unhealthy_threshold = 3
    timeout = 5
  }
  
  tags = var.common_tags
}

resource "aws_lb_listener" "pgbouncer" {
  load_balancer_arn = aws_lb.pgbouncer.arn
  
  port = "5432"
  protocol = "TCP"
  
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.pgbouncer.arn
  }
}

# Outputs
output "shard_0_endpoint" {
  value = aws_db_instance.shard_0.endpoint
}

output "shard_1_endpoint" {
  value = aws_db_instance.shard_1.endpoint
}

output "shard_2_endpoint" {
  value = aws_db_instance.shard_2.endpoint
}

output "shard_3_endpoint" {
  value = aws_db_instance.shard_3.endpoint
}

output "pgbouncer_endpoint" {
  value = aws_lb.pgbouncer.dns_name
}