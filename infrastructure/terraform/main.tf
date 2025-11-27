terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "ai-curator-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "ai-curator-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "AI-Gov-Content-Curator"
      ManagedBy   = "Terraform"
      Environment = var.environment
    }
  }
}

# VPC and Networking
module "vpc" {
  source = "./modules/vpc"

  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  public_subnets     = var.public_subnets
  private_subnets    = var.private_subnets
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  environment        = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnets    = module.vpc.public_subnet_ids
  certificate_arn   = var.certificate_arn
  enable_waf        = var.enable_waf
}

# ECS Cluster
module "ecs_cluster" {
  source = "./modules/ecs"

  environment = var.environment

  cluster_name              = "ai-curator-${var.environment}"
  container_insights        = true
  capacity_provider_fargate = true
  capacity_provider_spot    = var.enable_fargate_spot
}

# Backend Service with Blue/Green Deployment
module "backend_service" {
  source = "./modules/ecs-service"

  environment     = var.environment
  service_name    = "backend"
  cluster_id      = module.ecs_cluster.cluster_id
  cluster_name    = module.ecs_cluster.cluster_name

  # Task Definition
  task_cpu                 = var.backend_cpu
  task_memory              = var.backend_memory
  container_image          = var.backend_image
  container_port           = 3000
  container_cpu            = var.backend_cpu
  container_memory         = var.backend_memory

  # Networking
  vpc_id              = module.vpc.vpc_id
  private_subnets     = module.vpc.private_subnet_ids
  alb_target_group_arn = module.alb.backend_target_group_arn
  alb_security_group_id = module.alb.security_group_id

  # Auto Scaling
  desired_count     = var.backend_desired_count
  min_capacity      = var.backend_min_capacity
  max_capacity      = var.backend_max_capacity

  # Blue/Green Deployment
  deployment_controller = "CODE_DEPLOY"
  enable_blue_green    = true

  # Environment Variables
  environment_variables = [
    {
      name  = "NODE_ENV"
      value = "production"
    },
    {
      name  = "PORT"
      value = "3000"
    }
  ]

  # Secrets from Parameter Store
  secrets = [
    {
      name      = "MONGODB_URI"
      valueFrom = aws_ssm_parameter.mongodb_uri.arn
    },
    {
      name      = "GOOGLE_AI_API_KEY"
      valueFrom = aws_ssm_parameter.google_ai_key.arn
    },
    {
      name      = "RESEND_API_KEY"
      valueFrom = aws_ssm_parameter.resend_key.arn
    }
  ]

  # Health Checks
  health_check_path              = "/health"
  health_check_interval          = 30
  health_check_timeout           = 5
  health_check_healthy_threshold = 2
  health_check_unhealthy_threshold = 3
}

# Frontend Service
module "frontend_service" {
  source = "./modules/ecs-service"

  environment     = var.environment
  service_name    = "frontend"
  cluster_id      = module.ecs_cluster.cluster_id
  cluster_name    = module.ecs_cluster.cluster_name

  task_cpu                 = var.frontend_cpu
  task_memory              = var.frontend_memory
  container_image          = var.frontend_image
  container_port           = 3000
  container_cpu            = var.frontend_cpu
  container_memory         = var.frontend_memory

  vpc_id              = module.vpc.vpc_id
  private_subnets     = module.vpc.private_subnet_ids
  alb_target_group_arn = module.alb.frontend_target_group_arn
  alb_security_group_id = module.alb.security_group_id

  desired_count     = var.frontend_desired_count
  min_capacity      = var.frontend_min_capacity
  max_capacity      = var.frontend_max_capacity

  deployment_controller = "CODE_DEPLOY"
  enable_blue_green    = true

  environment_variables = [
    {
      name  = "NODE_ENV"
      value = "production"
    },
    {
      name  = "NEXT_PUBLIC_API_URL"
      value = "https://${module.alb.dns_name}"
    }
  ]

  health_check_path = "/api/health"
}

# Crawler Service (Scheduled Task)
module "crawler_scheduled_task" {
  source = "./modules/ecs-scheduled-task"

  environment     = var.environment
  task_name       = "crawler"
  cluster_arn     = module.ecs_cluster.cluster_arn

  task_cpu        = var.crawler_cpu
  task_memory     = var.crawler_memory
  container_image = var.crawler_image

  vpc_id          = module.vpc.vpc_id
  private_subnets = module.vpc.private_subnet_ids

  # Run daily at 6:00 AM UTC
  schedule_expression = "cron(0 6 * * ? *)"

  environment_variables = [
    {
      name  = "NODE_ENV"
      value = "production"
    }
  ]

  secrets = [
    {
      name      = "MONGODB_URI"
      valueFrom = aws_ssm_parameter.mongodb_uri.arn
    },
    {
      name      = "NEWS_API_KEY"
      valueFrom = aws_ssm_parameter.news_api_key.arn
    }
  ]
}

# Newsletter Service (Scheduled Task)
module "newsletter_scheduled_task" {
  source = "./modules/ecs-scheduled-task"

  environment     = var.environment
  task_name       = "newsletter"
  cluster_arn     = module.ecs_cluster.cluster_arn

  task_cpu        = var.newsletter_cpu
  task_memory     = var.newsletter_memory
  container_image = var.newsletter_image

  vpc_id          = module.vpc.vpc_id
  private_subnets = module.vpc.private_subnet_ids

  # Run daily at 9:00 AM UTC
  schedule_expression = "cron(0 9 * * ? *)"

  environment_variables = [
    {
      name  = "NODE_ENV"
      value = "production"
    }
  ]

  secrets = [
    {
      name      = "MONGODB_URI"
      valueFrom = aws_ssm_parameter.mongodb_uri.arn
    },
    {
      name      = "RESEND_API_KEY"
      valueFrom = aws_ssm_parameter.resend_key.arn
    }
  ]
}

# CodeDeploy for Blue/Green Deployments
module "codedeploy" {
  source = "./modules/codedeploy"

  environment = var.environment

  applications = {
    backend = {
      cluster_name         = module.ecs_cluster.cluster_name
      service_name         = module.backend_service.service_name
      alb_listener_arn     = module.alb.https_listener_arn
      target_group_blue    = module.alb.backend_target_group_arn
      target_group_green   = module.alb.backend_target_group_green_arn
      auto_rollback        = true
      termination_wait_time = 5
    }
    frontend = {
      cluster_name         = module.ecs_cluster.cluster_name
      service_name         = module.frontend_service.service_name
      alb_listener_arn     = module.alb.https_listener_arn
      target_group_blue    = module.alb.frontend_target_group_arn
      target_group_green   = module.alb.frontend_target_group_green_arn
      auto_rollback        = true
      termination_wait_time = 5
    }
  }
}

# CloudWatch Monitoring and Alarms
module "monitoring" {
  source = "./modules/monitoring"

  environment = var.environment

  cluster_name = module.ecs_cluster.cluster_name

  services = {
    backend = {
      service_name = module.backend_service.service_name
      alb_arn      = module.alb.alb_arn_suffix
      target_group = module.alb.backend_target_group_arn_suffix
    }
    frontend = {
      service_name = module.frontend_service.service_name
      alb_arn      = module.alb.alb_arn_suffix
      target_group = module.alb.frontend_target_group_arn_suffix
    }
  }

  sns_topic_arn = aws_sns_topic.alerts.arn
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name              = "ai-curator-${var.environment}-alerts"
  display_name      = "AI Curator Alerts"
  kms_master_key_id = aws_kms_key.sns.id
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# KMS Key for SNS Encryption
resource "aws_kms_key" "sns" {
  description             = "KMS key for SNS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
}

resource "aws_kms_alias" "sns" {
  name          = "alias/ai-curator-${var.environment}-sns"
  target_key_id = aws_kms_key.sns.key_id
}

# SSM Parameters for Secrets
resource "aws_ssm_parameter" "mongodb_uri" {
  name        = "/ai-curator/${var.environment}/mongodb-uri"
  description = "MongoDB connection URI"
  type        = "SecureString"
  value       = var.mongodb_uri

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "google_ai_key" {
  name        = "/ai-curator/${var.environment}/google-ai-key"
  description = "Google AI API Key"
  type        = "SecureString"
  value       = var.google_ai_api_key

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "resend_key" {
  name        = "/ai-curator/${var.environment}/resend-key"
  description = "Resend API Key"
  type        = "SecureString"
  value       = var.resend_api_key

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "news_api_key" {
  name        = "/ai-curator/${var.environment}/news-api-key"
  description = "News API Key"
  type        = "SecureString"
  value       = var.news_api_key

  lifecycle {
    ignore_changes = [value]
  }
}
