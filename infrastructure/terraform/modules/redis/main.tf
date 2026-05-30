# ElastiCache Redis — Session cache, rate limiting, pub/sub
# Multi-AZ replication group with automatic failover

variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "node_type" { type = string }
variable "num_cache_nodes" { type = number }
variable "allowed_security_groups" { type = list(string) }

resource "aws_elasticache_subnet_group" "main" {
  name       = "valueskins-${var.environment}"
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "redis" {
  name_prefix = "valueskins-redis-${var.environment}-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "valueskins-${var.environment}"
  description          = "Valueskins Redis cluster"
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_nodes

  engine               = "redis"
  engine_version       = "7.1"
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  automatic_failover_enabled = true
  multi_az_enabled           = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  snapshot_retention_limit = 7
  snapshot_window          = "03:00-05:00"
  maintenance_window       = "Mon:05:00-Mon:06:00"

  apply_immediately = false
}

output "endpoint" { value = aws_elasticache_replication_group.main.primary_endpoint_address }
output "reader_endpoint" { value = aws_elasticache_replication_group.main.reader_endpoint_address }
