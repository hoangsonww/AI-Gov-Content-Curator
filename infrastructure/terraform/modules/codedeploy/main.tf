# IAM Role for CodeDeploy
resource "aws_iam_role" "codedeploy" {
  name = "ai-curator-${var.environment}-codedeploy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codedeploy.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "ai-curator-${var.environment}-codedeploy-role"
  }
}

resource "aws_iam_role_policy_attachment" "codedeploy" {
  role       = aws_iam_role.codedeploy.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployRoleForECS"
}

# SNS Topic for Deployment Notifications
resource "aws_sns_topic" "deployment_notifications" {
  name         = "ai-curator-${var.environment}-deployment-notifications"
  display_name = "AI Curator Deployment Notifications"

  tags = {
    Name = "ai-curator-${var.environment}-deployment-notifications"
  }
}

resource "aws_sns_topic_subscription" "deployment_email" {
  count = var.notification_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.deployment_notifications.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

# CodeDeploy Applications and Deployment Groups for each service
resource "aws_codedeploy_app" "app" {
  for_each = var.applications

  name             = "ai-curator-${var.environment}-${each.key}"
  compute_platform = "ECS"

  tags = {
    Name = "ai-curator-${var.environment}-${each.key}"
  }
}

resource "aws_codedeploy_deployment_group" "deployment_group" {
  for_each = var.applications

  app_name               = aws_codedeploy_app.app[each.key].name
  deployment_group_name  = "ai-curator-${var.environment}-${each.key}-dg"
  service_role_arn       = aws_iam_role.codedeploy.arn
  deployment_config_name = each.value.deployment_config_name

  auto_rollback_configuration {
    enabled = each.value.auto_rollback
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }

  blue_green_deployment_config {
    terminate_blue_instances_on_deployment_success {
      action                           = "TERMINATE"
      termination_wait_time_in_minutes = each.value.termination_wait_time
    }

    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT"
    }
  }

  deployment_style {
    deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "BLUE_GREEN"
  }

  ecs_service {
    cluster_name = each.value.cluster_name
    service_name = each.value.service_name
  }

  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route {
        listener_arns = [each.value.alb_listener_arn]
      }

      target_group {
        name = split(":", each.value.target_group_blue)[1]
      }

      target_group {
        name = split(":", each.value.target_group_green)[1]
      }

      test_traffic_route {
        listener_arns = length(each.value.test_listener_arns) > 0 ? each.value.test_listener_arns : []
      }
    }
  }

  # Alarm configuration for automatic rollback
  dynamic "alarm_configuration" {
    for_each = length(each.value.alarm_arns) > 0 ? [1] : []
    content {
      alarms  = each.value.alarm_arns
      enabled = true
    }
  }

  # Deployment notifications
  trigger_configuration {
    trigger_events = [
      "DeploymentStart",
      "DeploymentSuccess",
      "DeploymentFailure",
      "DeploymentStop",
      "DeploymentRollback"
    ]
    trigger_name       = "deployment-notifications"
    trigger_target_arn = aws_sns_topic.deployment_notifications.arn
  }

  tags = {
    Name = "ai-curator-${var.environment}-${each.key}-dg"
  }
}

# CloudWatch Alarms for each service
resource "aws_cloudwatch_metric_alarm" "deployment_failure" {
  for_each = var.applications

  alarm_name          = "ai-curator-${var.environment}-${each.key}-deployment-failure"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "This metric monitors unhealthy hosts in the ${each.key} target group"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = split(":", each.value.target_group_blue)[1]
    LoadBalancer = split("/", each.value.alb_listener_arn)[1]
  }

  alarm_actions = [aws_sns_topic.deployment_notifications.arn]

  tags = {
    Name = "ai-curator-${var.environment}-${each.key}-deployment-failure"
  }
}

# Deployment Config - Canary with 10% traffic shift every 5 minutes
resource "aws_codedeploy_deployment_config" "canary_10_percent_5_minutes" {
  deployment_config_name = "ai-curator-${var.environment}-canary-10-5"
  compute_platform       = "ECS"

  traffic_routing_config {
    type = "TimeBasedCanary"

    time_based_canary {
      interval   = 5
      percentage = 10
    }
  }

  tags = {
    Name = "ai-curator-${var.environment}-canary-10-5"
  }
}

# Deployment Config - Linear with 10% traffic shift every 1 minute
resource "aws_codedeploy_deployment_config" "linear_10_percent_1_minute" {
  deployment_config_name = "ai-curator-${var.environment}-linear-10-1"
  compute_platform       = "ECS"

  traffic_routing_config {
    type = "TimeBasedLinear"

    time_based_linear {
      interval   = 1
      percentage = 10
    }
  }

  tags = {
    Name = "ai-curator-${var.environment}-linear-10-1"
  }
}

# Deployment Config - All at once
resource "aws_codedeploy_deployment_config" "all_at_once" {
  deployment_config_name = "ai-curator-${var.environment}-all-at-once"
  compute_platform       = "ECS"

  traffic_routing_config {
    type = "AllAtOnce"
  }

  tags = {
    Name = "ai-curator-${var.environment}-all-at-once"
  }
}
