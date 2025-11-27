# Advanced Auto-Scaling Configuration
# Supports predictive scaling, scheduled scaling, and custom metrics

# Application Auto Scaling Target for ECS Services
resource "aws_appautoscaling_scheduled_action" "scale_up_morning" {
  name               = "scale-up-morning"
  service_namespace  = "ecs"
  resource_id        = "service/${module.ecs_cluster.cluster_name}/${module.backend_service.service_name}"
  scalable_dimension = "ecs:service:DesiredCount"
  schedule           = "cron(0 7 * * MON-FRI *)"

  scalable_target_action {
    min_capacity = 5
    max_capacity = 20
  }
}

resource "aws_appautoscaling_scheduled_action" "scale_down_evening" {
  name               = "scale-down-evening"
  service_namespace  = "ecs"
  resource_id        = "service/${module.ecs_cluster.cluster_name}/${module.backend_service.service_name}"
  scalable_dimension = "ecs:service:DesiredCount"
  schedule           = "cron(0 20 * * MON-FRI *)"

  scalable_target_action {
    min_capacity = 2
    max_capacity = 10
  }
}

# Predictive Scaling Policy
resource "aws_autoscaling_policy" "predictive_scaling" {
  count = var.enable_predictive_scaling ? 1 : 0

  name                   = "ai-curator-${var.environment}-predictive-scaling"
  autoscaling_group_name = aws_autoscaling_group.workers[0].name
  policy_type            = "PredictiveScaling"

  predictive_scaling_configuration {
    metric_specification {
      target_value = 70.0

      predefined_load_metric_specification {
        predefined_metric_type = "ASGTotalCPUUtilization"
      }

      predefined_scaling_metric_specification {
        predefined_metric_type = "ASGAverageCPUUtilization"
      }
    }

    mode                         = "ForecastAndScale"
    scheduling_buffer_time       = 600
    max_capacity_breach_behavior = "IncreaseMaxCapacity"
  }
}

# Step Scaling Policy for Sudden Traffic Spikes
resource "aws_appautoscaling_policy" "step_scaling" {
  name               = "ai-curator-${var.environment}-step-scaling"
  service_namespace  = "ecs"
  resource_id        = "service/${module.ecs_cluster.cluster_name}/${module.backend_service.service_name}"
  scalable_dimension = "ecs:service:DesiredCount"
  policy_type        = "StepScaling"

  step_scaling_policy_configuration {
    adjustment_type         = "PercentChangeInCapacity"
    cooldown                = 60
    metric_aggregation_type = "Average"

    step_adjustment {
      metric_interval_lower_bound = 0
      metric_interval_upper_bound = 10
      scaling_adjustment          = 10
    }

    step_adjustment {
      metric_interval_lower_bound = 10
      metric_interval_upper_bound = 20
      scaling_adjustment          = 20
    }

    step_adjustment {
      metric_interval_lower_bound = 20
      scaling_adjustment          = 30
    }
  }
}

# Custom CloudWatch Metric for Business Logic
resource "aws_cloudwatch_metric_alarm" "custom_metric_high" {
  alarm_name          = "ai-curator-${var.environment}-high-article-processing"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ArticlesProcessingQueue"
  namespace           = "AI-Curator"
  period              = "60"
  statistic           = "Average"
  threshold           = "100"
  alarm_description   = "This metric monitors article processing queue depth"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [aws_appautoscaling_policy.step_scaling.arn]
}

# SQS-based Auto Scaling
resource "aws_sqs_queue" "article_processing" {
  name                       = "ai-curator-${var.environment}-article-processing"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 86400
  receive_wait_time_seconds  = 10
  visibility_timeout_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.article_processing_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name = "ai-curator-${var.environment}-article-processing"
  }
}

resource "aws_sqs_queue" "article_processing_dlq" {
  name = "ai-curator-${var.environment}-article-processing-dlq"

  tags = {
    Name = "ai-curator-${var.environment}-article-processing-dlq"
  }
}

# Auto Scaling based on SQS Queue Depth
resource "aws_appautoscaling_policy" "sqs_scaling" {
  name               = "ai-curator-${var.environment}-sqs-scaling"
  service_namespace  = "ecs"
  resource_id        = "service/${module.ecs_cluster.cluster_name}/${module.backend_service.service_name}"
  scalable_dimension = "ecs:service:DesiredCount"
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    target_value       = 10
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    customized_metric_specification {
      metric_name = "ApproximateNumberOfMessagesVisible"
      namespace   = "AWS/SQS"
      statistic   = "Average"
      unit        = "Count"

      dimensions {
        name  = "QueueName"
        value = aws_sqs_queue.article_processing.name
      }
    }
  }
}

# EventBridge for Scaling Events
resource "aws_cloudwatch_event_rule" "scaling_events" {
  name        = "ai-curator-${var.environment}-scaling-events"
  description = "Capture ECS scaling events"

  event_pattern = jsonencode({
    source      = ["aws.ecs"]
    detail-type = ["ECS Service Action"]
    detail = {
      eventName = ["SERVICE_TASK_PLACEMENT_SUCCESS", "SERVICE_TASK_PLACEMENT_FAILURE"]
    }
  })
}

resource "aws_cloudwatch_event_target" "scaling_events_lambda" {
  rule      = aws_cloudwatch_event_rule.scaling_events.name
  target_id = "ScalingEventsLambda"
  arn       = aws_lambda_function.scaling_events_handler.arn
}

# Lambda for Scaling Event Processing
resource "aws_lambda_function" "scaling_events_handler" {
  filename      = "scaling-events-handler.zip"
  function_name = "ai-curator-${var.environment}-scaling-events"
  role          = aws_iam_role.scaling_events_lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30

  environment {
    variables = {
      ENVIRONMENT = var.environment
      SLACK_WEBHOOK_URL = var.slack_webhook_url
    }
  }

  tags = {
    Name = "ai-curator-${var.environment}-scaling-events"
  }
}

resource "aws_iam_role" "scaling_events_lambda" {
  name = "ai-curator-${var.environment}-scaling-events-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Cost Optimization - Fargate Spot
resource "aws_ecs_capacity_provider" "fargate_spot" {
  name = "ai-curator-${var.environment}-fargate-spot"

  auto_scaling_group_provider {
    managed_scaling {
      maximum_scaling_step_size = 10
      minimum_scaling_step_size = 1
      status                    = "ENABLED"
      target_capacity           = 80
    }

    managed_termination_protection = "DISABLED"
  }

  tags = {
    Name = "ai-curator-${var.environment}-fargate-spot"
  }
}

# Capacity Provider Strategy
resource "aws_ecs_cluster_capacity_providers" "spot_strategy" {
  cluster_name = module.ecs_cluster.cluster_name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 70
    base              = 0
  }

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 30
    base              = 1
  }
}

# Lambda for Cost Optimization Reports
resource "aws_lambda_function" "cost_optimizer" {
  filename      = "cost-optimizer.zip"
  function_name = "ai-curator-${var.environment}-cost-optimizer"
  role          = aws_iam_role.cost_optimizer_lambda.arn
  handler       = "index.handler"
  runtime       = "python3.11"
  timeout       = 300

  environment {
    variables = {
      ENVIRONMENT = var.environment
      CLUSTER_NAME = module.ecs_cluster.cluster_name
    }
  }

  tags = {
    Name = "ai-curator-${var.environment}-cost-optimizer"
  }
}

resource "aws_iam_role" "cost_optimizer_lambda" {
  name = "ai-curator-${var.environment}-cost-optimizer-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "cost_optimizer_policy" {
  name = "cost-optimizer-policy"
  role = aws_iam_role.cost_optimizer_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ce:GetCostAndUsage",
          "ce:GetCostForecast",
          "ecs:DescribeServices",
          "ecs:DescribeClusters",
          "cloudwatch:GetMetricStatistics"
        ]
        Resource = "*"
      }
    ]
  })
}

# Scheduled Lambda for Daily Cost Reports
resource "aws_cloudwatch_event_rule" "cost_report_daily" {
  name                = "ai-curator-${var.environment}-cost-report-daily"
  description         = "Trigger daily cost optimization report"
  schedule_expression = "cron(0 9 * * ? *)"
}

resource "aws_cloudwatch_event_target" "cost_report_lambda" {
  rule      = aws_cloudwatch_event_rule.cost_report_daily.name
  target_id = "CostReportLambda"
  arn       = aws_lambda_function.cost_optimizer.arn
}

resource "aws_lambda_permission" "allow_eventbridge_cost_report" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cost_optimizer.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cost_report_daily.arn
}
