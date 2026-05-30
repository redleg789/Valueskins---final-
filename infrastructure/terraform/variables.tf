variable "project" {
  type    = string
  default = "valueskins"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "dr_region" {
  type        = string
  default     = "us-west-2"
  description = "Disaster recovery region"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# EKS
variable "eks_node_min" {
  type    = number
  default = 3
}

variable "eks_node_max" {
  type    = number
  default = 50
}

variable "eks_node_instance" {
  type    = string
  default = "m6i.xlarge"
}

# RDS
variable "rds_instance_class" {
  type    = string
  default = "db.r6g.xlarge"
}

variable "rds_storage_gb" {
  type    = number
  default = 200
}

variable "rds_backup_retention" {
  type    = number
  default = 30
}

# Redis
variable "redis_node_type" {
  type    = string
  default = "cache.r6g.large"
}

variable "redis_num_nodes" {
  type    = number
  default = 3
}

# Kafka
variable "kafka_broker_count" {
  type    = number
  default = 3
}

variable "kafka_instance_type" {
  type    = string
  default = "kafka.m5.large"
}

# Domain & SSL
variable "domain_name" {
  type    = string
  default = "valueskins.io"
}

# Alerting
variable "alert_email" {
  type    = string
  default = "ops@valueskins.io"
}
