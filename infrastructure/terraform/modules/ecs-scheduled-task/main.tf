# Security Group for Scheduled Task
resource "aws_security_group" "task" {
  name        = "ai-curator-${var.environment}-${var.task_name}-sg"
  description = "Security group for ${var.task_name} scheduled task"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name = "ai-curator-${var.environment}-${var.task_name}-sg"
  }
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_task_execution" {
  name = "ai-curator-${var.environment}-${var.task_name}-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "ai-curator-${var.environment}-${var.task_name}-exec-role"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_ssm" {
  name = "ssm-secrets-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]
        Resource = "arn:aws:ssm:*:*:parameter/ai-curator/${var.environment}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM Role for ECS Task
resource "aws_iam_role" "ecs_task" {
  name = "ai-curator-${var.environment}-${var.task_name}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "ai-curator-${var.environment}-${var.task_name}-task-role"
  }
}

# CloudWatch Logs for the task
resource "aws_cloudwatch_log_group" "task" {
  name              = "/ecs/ai-curator-${var.environment}-${var.task_name}"
  retention_in_days = 7

  tags = {
    Name = "ai-curator-${var.environment}-${var.task_name}-logs"
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "task" {
  family                   = "ai-curator-${var.environment}-${var.task_name}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = var.task_name
      image     = var.container_image
      cpu       = var.task_cpu
      memory    = var.task_memory
      essential = true

      environment = var.environment_variables

      secrets = var.secrets

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.task.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "ai-curator-${var.environment}-${var.task_name}-task"
  }
}

data "aws_region" "current" {}

# IAM Role for EventBridge
resource "aws_iam_role" "eventbridge" {
  name = "ai-curator-${var.environment}-${var.task_name}-eventbridge-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "ai-curator-${var.environment}-${var.task_name}-eventbridge-role"
  }
}

resource "aws_iam_role_policy" "eventbridge_ecs" {
  name = "ecs-run-task"
  role = aws_iam_role.eventbridge.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:RunTask"
        ]
        Resource = aws_ecs_task_definition.task.arn
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = [
          aws_iam_role.ecs_task_execution.arn,
          aws_iam_role.ecs_task.arn
        ]
      }
    ]
  })
}

# EventBridge Rule for Scheduled Task
resource "aws_cloudwatch_event_rule" "scheduled_task" {
  name                = "ai-curator-${var.environment}-${var.task_name}-schedule"
  description         = "Scheduled task for ${var.task_name}"
  schedule_expression = var.schedule_expression
  is_enabled          = var.enabled

  tags = {
    Name = "ai-curator-${var.environment}-${var.task_name}-schedule"
  }
}

resource "aws_cloudwatch_event_target" "scheduled_task" {
  rule      = aws_cloudwatch_event_rule.scheduled_task.name
  target_id = "ecs-scheduled-task"
  arn       = var.cluster_arn
  role_arn  = aws_iam_role.eventbridge.arn

  ecs_target {
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.task.arn
    launch_type         = "FARGATE"
    platform_version    = "LATEST"

    network_configuration {
      subnets          = var.private_subnets
      security_groups  = [aws_security_group.task.id]
      assign_public_ip = false
    }
  }
}
