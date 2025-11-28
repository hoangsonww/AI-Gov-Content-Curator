# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "ai-curator-${var.environment}"

  dashboard_body = jsonencode({
    widgets = concat(
      # Service metrics for each service
      flatten([
        for service_key, service in var.services : [
          # CPU Utilization
          {
            type = "metric"
            properties = {
              metrics = [
                ["AWS/ECS", "CPUUtilization", "ServiceName", service.service_name, "ClusterName", var.cluster_name]
              ]
              period = 300
              stat   = "Average"
              region = data.aws_region.current.name
              title  = "${service_key} - CPU Utilization"
              yAxis = {
                left = {
                  min = 0
                  max = 100
                }
              }
            }
          },
          # Memory Utilization
          {
            type = "metric"
            properties = {
              metrics = [
                ["AWS/ECS", "MemoryUtilization", "ServiceName", service.service_name, "ClusterName", var.cluster_name]
              ]
              period = 300
              stat   = "Average"
              region = data.aws_region.current.name
              title  = "${service_key} - Memory Utilization"
              yAxis = {
                left = {
                  min = 0
                  max = 100
                }
              }
            }
          },
          # Request Count
          {
            type = "metric"
            properties = {
              metrics = [
                ["AWS/ApplicationELB", "RequestCount", "TargetGroup", service.target_group, "LoadBalancer", service.alb_arn, { stat = "Sum" }]
              ]
              period = 300
              stat   = "Sum"
              region = data.aws_region.current.name
              title  = "${service_key} - Request Count"
            }
          },
          # Response Time
          {
            type = "metric"
            properties = {
              metrics = [
                ["AWS/ApplicationELB", "TargetResponseTime", "TargetGroup", service.target_group, "LoadBalancer", service.alb_arn, { stat = "Average" }]
              ]
              period = 300
              stat   = "Average"
              region = data.aws_region.current.name
              title  = "${service_key} - Response Time"
            }
          },
          # Target Health
          {
            type = "metric"
            properties = {
              metrics = [
                ["AWS/ApplicationELB", "HealthyHostCount", "TargetGroup", service.target_group, "LoadBalancer", service.alb_arn],
                [".", "UnHealthyHostCount", ".", ".", ".", "."]
              ]
              period = 300
              stat   = "Average"
              region = data.aws_region.current.name
              title  = "${service_key} - Target Health"
            }
          },
          # HTTP Errors
          {
            type = "metric"
            properties = {
              metrics = [
                ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "TargetGroup", service.target_group, "LoadBalancer", service.alb_arn, { stat = "Sum" }],
                [".", "HTTPCode_Target_5XX_Count", ".", ".", ".", ".", { stat = "Sum" }]
              ]
              period = 300
              stat   = "Sum"
              region = data.aws_region.current.name
              title  = "${service_key} - HTTP Errors"
            }
          }
        ]
      ])
    )
  })
}

data "aws_region" "current" {}

# CloudWatch Alarms for each service
# High CPU Utilization
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  for_each = var.services

  alarm_name          = "ai-curator-${var.environment}-${each.key}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.cpu_high_threshold
  alarm_description   = "This metric monitors ${each.key} CPU utilization"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ServiceName = each.value.service_name
    ClusterName = var.cluster_name
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = {
    Name = "ai-curator-${var.environment}-${each.key}-cpu-high"
  }
}

# High Memory Utilization
resource "aws_cloudwatch_metric_alarm" "memory_high" {
  for_each = var.services

  alarm_name          = "ai-curator-${var.environment}-${each.key}-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.memory_high_threshold
  alarm_description   = "This metric monitors ${each.key} memory utilization"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ServiceName = each.value.service_name
    ClusterName = var.cluster_name
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = {
    Name = "ai-curator-${var.environment}-${each.key}-memory-high"
  }
}

# Unhealthy Hosts
resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  for_each = var.services

  alarm_name          = "ai-curator-${var.environment}-${each.key}-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "This metric monitors unhealthy hosts for ${each.key}"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = each.value.target_group
    LoadBalancer = each.value.alb_arn
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = {
    Name = "ai-curator-${var.environment}-${each.key}-unhealthy-hosts"
  }
}

# High Response Time
resource "aws_cloudwatch_metric_alarm" "high_response_time" {
  for_each = var.services

  alarm_name          = "ai-curator-${var.environment}-${each.key}-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = var.response_time_threshold
  alarm_description   = "This metric monitors response time for ${each.key}"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = each.value.target_group
    LoadBalancer = each.value.alb_arn
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = {
    Name = "ai-curator-${var.environment}-${each.key}-high-response-time"
  }
}

# High 5XX Error Rate
resource "aws_cloudwatch_metric_alarm" "high_5xx_errors" {
  for_each = var.services

  alarm_name          = "ai-curator-${var.environment}-${each.key}-high-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.error_5xx_threshold
  alarm_description   = "This metric monitors 5XX errors for ${each.key}"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = each.value.target_group
    LoadBalancer = each.value.alb_arn
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = {
    Name = "ai-curator-${var.environment}-${each.key}-high-5xx-errors"
  }
}

# High 4XX Error Rate
resource "aws_cloudwatch_metric_alarm" "high_4xx_errors" {
  for_each = var.services

  alarm_name          = "ai-curator-${var.environment}-${each.key}-high-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_4XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.error_4xx_threshold
  alarm_description   = "This metric monitors 4XX errors for ${each.key}"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = each.value.target_group
    LoadBalancer = each.value.alb_arn
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = {
    Name = "ai-curator-${var.environment}-${each.key}-high-4xx-errors"
  }
}

# Composite Alarm for Service Health
resource "aws_cloudwatch_composite_alarm" "service_unhealthy" {
  for_each = var.services

  alarm_name          = "ai-curator-${var.environment}-${each.key}-service-unhealthy"
  alarm_description   = "Composite alarm for ${each.key} service health"
  actions_enabled     = true
  alarm_actions       = [var.sns_topic_arn]
  ok_actions          = [var.sns_topic_arn]

  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.cpu_high[each.key].alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.memory_high[each.key].alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.unhealthy_hosts[each.key].alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.high_5xx_errors[each.key].alarm_name})"
  ])

  tags = {
    Name = "ai-curator-${var.environment}-${each.key}-service-unhealthy"
  }
}

# Log Insights Queries
resource "aws_cloudwatch_query_definition" "error_logs" {
  name = "ai-curator-${var.environment}-error-logs"

  log_group_names = [
    for service in var.services :
    "/ecs/ai-curator-${var.environment}-${service.service_name}"
  ]

  query_string = <<-QUERY
    fields @timestamp, @message
    | filter @message like /ERROR/
    | sort @timestamp desc
    | limit 100
  QUERY
}

resource "aws_cloudwatch_query_definition" "slow_requests" {
  name = "ai-curator-${var.environment}-slow-requests"

  log_group_names = [
    for service in var.services :
    "/ecs/ai-curator-${var.environment}-${service.service_name}"
  ]

  query_string = <<-QUERY
    fields @timestamp, @message
    | filter @message like /duration/
    | parse @message /duration: (?<duration>\d+)ms/
    | filter duration > 1000
    | sort duration desc
    | limit 100
  QUERY
}
