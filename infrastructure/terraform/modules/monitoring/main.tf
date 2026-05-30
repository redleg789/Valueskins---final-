# CloudWatch Monitoring + Prometheus + Grafana

resource "aws_cloudwatch_log_group" "eks" {
  name              = "/aws/eks/valueskins"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "rds" {
  name              = "/aws/rds/valueskins"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/valueskins/application"
  retention_in_days = 30
}

# CloudWatch Alarms

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "valueskins-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = [var.sns_topic_arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "valueskins-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 70
  alarm_actions       = [var.sns_topic_arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "valueskins-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 800
  alarm_actions       = [var.sns_topic_arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "valueskins-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 75
  alarm_actions       = [var.sns_topic_arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "valueskins-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_actions       = [var.sns_topic_arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "elb_unhealthy" {
  alarm_name          = "valueskins-elb-unhealthy-hosts"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ELB"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  alarm_actions       = [var.sns_topic_arn]
  treat_missing_data  = "notBreaching"
}

# Custom Metrics Dashboard

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "valueskins-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", { stat = "Average" }],
            [".", "RequestCount", { stat = "Sum" }],
            [".", "HTTPCode_Target_5XX_Count", { stat = "Sum" }],
            ["AWS/RDS", "CPUUtilization"],
            ["AWS/RDS", "DatabaseConnections"],
            ["AWS/ElastiCache", "CPUUtilization"],
            ["AWS/ElastiCache", "DatabaseMemoryUsagePercentage"],
            ["AWS/MSK", "BytesInPerSec"],
            ["AWS/MSK", "BytesOutPerSec"]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "System Metrics"
        }
      },
      {
        type = "log"
        properties = {
          query   = "fields @timestamp, @message | stats count() as ErrorCount by bin(5m)"
          region  = var.aws_region
          title   = "Application Errors"
        }
      }
    ]
  })
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "valueskins-alerts-${var.environment}"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch Event Rules for automated responses

resource "aws_cloudwatch_event_rule" "high_error_rate" {
  name        = "valueskins-high-error-rate"
  description = "Trigger when error rate exceeds threshold"

  event_pattern = jsonencode({
    source      = ["aws.cloudwatch"]
    detail-type = ["CloudWatch Alarm State Change"]
    detail = {
      alarmName = [
        "valueskins-api-errors-high",
        "valueskins-api-latency-high"
      ]
      state = {
        value = ["ALARM"]
      }
    }
  })
}

resource "aws_cloudwatch_event_target" "sns" {
  rule      = aws_cloudwatch_event_rule.high_error_rate.name
  target_id = "AlertSNS"
  arn       = aws_sns_topic.alerts.arn
}

# Prometheus in Kubernetes namespace (installed separately)
resource "aws_prometheus_workspace" "main" {
  alias = "valueskins-${var.environment}"
}

# Grafana (installed in EKS)
resource "aws_grafana_workspace" "main" {
  name                     = "valueskins-${var.environment}"
  role_arn                 = aws_iam_role.grafana.arn
  data_sources             = ["CLOUDWATCH", "PROMETHEUS"]
  authentication_providers = ["AWS_SSO"]
}

resource "aws_iam_role" "grafana" {
  name = "grafana-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "grafana.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "grafana" {
  name   = "grafana-policy"
  role   = aws_iam_role.grafana.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:GetMetricData",
          "cloudwatch:ListMetrics",
          "cloudwatch:DescribeAlarms",
          "logs:DescribeLogGroups",
          "logs:GetLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

output "log_group_application" {
  value = aws_cloudwatch_log_group.application.name
}

output "sns_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "prometheus_workspace_id" {
  value = aws_prometheus_workspace.main.id
}

output "grafana_workspace_url" {
  value = aws_grafana_workspace.main.endpoint
}
