# Splunk Integration
# Routes ECS container logs from CloudWatch to Splunk via Kinesis Data Firehose

module "splunk" {
  source = "./modules/splunk"
  count  = var.enable_splunk ? 1 : 0

  environment         = var.environment
  splunk_hec_endpoint = var.splunk_hec_endpoint
  splunk_hec_token    = var.splunk_hec_token
  vpc_id              = module.vpc.vpc_id
  splunk_index        = var.splunk_index

  ecs_log_group_names = {
    backend    = "/ecs/ai-curator-${var.environment}-backend"
    frontend   = "/ecs/ai-curator-${var.environment}-frontend"
    crawler    = "/ecs/ai-curator-${var.environment}-crawler"
    newsletter = "/ecs/ai-curator-${var.environment}-newsletter"
  }

  ecs_log_group_arns = {
    backend    = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/ai-curator-${var.environment}-backend:*"
    frontend   = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/ai-curator-${var.environment}-frontend:*"
    crawler    = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/ai-curator-${var.environment}-crawler:*"
    newsletter = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/ai-curator-${var.environment}-newsletter:*"
  }

  enable_s3_backup  = true
  buffering_interval = 60
  buffering_size     = 5
  retry_duration     = 300
}

# CloudWatch Log Groups for ECS services (referenced by Splunk module)
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/ai-curator-${var.environment}-backend"
  retention_in_days = var.log_retention_days

  tags = {
    Service = "backend"
  }
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/ai-curator-${var.environment}-frontend"
  retention_in_days = var.log_retention_days

  tags = {
    Service = "frontend"
  }
}

resource "aws_cloudwatch_log_group" "crawler" {
  name              = "/ecs/ai-curator-${var.environment}-crawler"
  retention_in_days = var.log_retention_days

  tags = {
    Service = "crawler"
  }
}

resource "aws_cloudwatch_log_group" "newsletter" {
  name              = "/ecs/ai-curator-${var.environment}-newsletter"
  retention_in_days = var.log_retention_days

  tags = {
    Service = "newsletter"
  }
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}
