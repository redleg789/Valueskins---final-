# MSK Kafka — Async event processing, CQRS event bus
# Used for: deal completion events, reputation recalculation, notifications

variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "broker_count" { type = number }
variable "instance_type" { type = string }
variable "allowed_security_groups" { type = list(string) }

resource "aws_security_group" "kafka" {
  name_prefix = "valueskins-kafka-${var.environment}-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 9092
    to_port         = 9098
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_kms_key" "kafka" {
  description         = "MSK encryption for valueskins-${var.environment}"
  enable_key_rotation = true
}

resource "aws_msk_cluster" "main" {
  cluster_name           = "valueskins-${var.environment}"
  kafka_version          = "3.6.0"
  number_of_broker_nodes = var.broker_count

  broker_node_group_info {
    instance_type  = var.instance_type
    client_subnets = var.subnet_ids
    security_groups = [aws_security_group.kafka.id]

    storage_info {
      ebs_storage_info {
        volume_size = 200
      }
    }
  }

  encryption_info {
    encryption_at_rest_kms_key_arn = aws_kms_key.kafka.arn
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.main.arn
    revision = aws_msk_configuration.main.latest_revision
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.kafka.name
      }
    }
  }

  open_monitoring {
    prometheus {
      jmx_exporter {
        enabled_in_broker = true
      }
      node_exporter {
        enabled_in_broker = true
      }
    }
  }
}

resource "aws_msk_configuration" "main" {
  name              = "valueskins-${var.environment}"
  kafka_versions    = ["3.6.0"]

  server_properties = <<PROPERTIES
auto.create.topics.enable=false
default.replication.factor=3
min.insync.replicas=2
num.partitions=12
log.retention.hours=168
PROPERTIES
}

resource "aws_cloudwatch_log_group" "kafka" {
  name              = "/aws/msk/valueskins-${var.environment}"
  retention_in_days = 30
}

output "bootstrap_brokers_tls" { value = aws_msk_cluster.main.bootstrap_brokers_tls }
output "zookeeper_connect" { value = aws_msk_cluster.main.zookeeper_connect_string }
