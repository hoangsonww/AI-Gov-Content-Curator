variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^(us|eu|ap|sa|ca|me|af)-(north|south|east|west|central|northeast|southeast)-[1-3]$", var.aws_region))
    error_message = "Must be a valid AWS region."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones for the region"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "public_subnets" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnets" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]
}

variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS"
  type        = string
}

variable "enable_waf" {
  description = "Enable AWS WAF on ALB"
  type        = bool
  default     = true
}

variable "enable_fargate_spot" {
  description = "Enable Fargate Spot capacity provider"
  type        = bool
  default     = true
}

# Backend Service Configuration
variable "backend_cpu" {
  description = "CPU units for backend service (1024 = 1 vCPU)"
  type        = number
  default     = 1024
}

variable "backend_memory" {
  description = "Memory for backend service in MB"
  type        = number
  default     = 2048
}

variable "backend_desired_count" {
  description = "Desired number of backend tasks"
  type        = number
  default     = 2
}

variable "backend_min_capacity" {
  description = "Minimum number of backend tasks"
  type        = number
  default     = 2
}

variable "backend_max_capacity" {
  description = "Maximum number of backend tasks"
  type        = number
  default     = 10
}

variable "backend_image" {
  description = "Docker image for backend service"
  type        = string

  validation {
    condition     = !can(regex(":latest$", var.backend_image))
    error_message = "Image tag :latest is not allowed. Use a pinned version or SHA digest."
  }
}

# Frontend Service Configuration
variable "frontend_cpu" {
  description = "CPU units for frontend service"
  type        = number
  default     = 512
}

variable "frontend_memory" {
  description = "Memory for frontend service in MB"
  type        = number
  default     = 1024
}

variable "frontend_desired_count" {
  description = "Desired number of frontend tasks"
  type        = number
  default     = 2
}

variable "frontend_min_capacity" {
  description = "Minimum number of frontend tasks"
  type        = number
  default     = 2
}

variable "frontend_max_capacity" {
  description = "Maximum number of frontend tasks"
  type        = number
  default     = 10
}

variable "frontend_image" {
  description = "Docker image for frontend service"
  type        = string

  validation {
    condition     = !can(regex(":latest$", var.frontend_image))
    error_message = "Image tag :latest is not allowed. Use a pinned version or SHA digest."
  }
}

# Crawler Service Configuration
variable "crawler_cpu" {
  description = "CPU units for crawler task"
  type        = number
  default     = 512
}

variable "crawler_memory" {
  description = "Memory for crawler task in MB"
  type        = number
  default     = 1024
}

variable "crawler_image" {
  description = "Docker image for crawler service"
  type        = string

  validation {
    condition     = !can(regex(":latest$", var.crawler_image))
    error_message = "Image tag :latest is not allowed. Use a pinned version or SHA digest."
  }
}

# Newsletter Service Configuration
variable "newsletter_cpu" {
  description = "CPU units for newsletter task"
  type        = number
  default     = 512
}

variable "newsletter_memory" {
  description = "Memory for newsletter task in MB"
  type        = number
  default     = 1024
}

variable "newsletter_image" {
  description = "Docker image for newsletter service"
  type        = string

  validation {
    condition     = !can(regex(":latest$", var.newsletter_image))
    error_message = "Image tag :latest is not allowed. Use a pinned version or SHA digest."
  }
}

# Secrets (should be set via environment variables or tfvars file)
variable "mongodb_uri" {
  description = "MongoDB connection URI"
  type        = string
  sensitive   = true
}

variable "google_ai_api_key" {
  description = "Google AI API Key"
  type        = string
  sensitive   = true
}

variable "resend_api_key" {
  description = "Resend API Key"
  type        = string
  sensitive   = true
}

variable "news_api_key" {
  description = "News API Key"
  type        = string
  sensitive   = true
}

variable "alert_email" {
  description = "Email address for CloudWatch alerts"
  type        = string
}

# Splunk Integration Configuration
variable "enable_splunk" {
  description = "Enable Splunk integration via Kinesis Data Firehose"
  type        = bool
  default     = false
}

variable "splunk_hec_endpoint" {
  description = "Splunk HTTP Event Collector endpoint URL (e.g. https://splunk.example.com:8088)"
  type        = string
  default     = ""
}

variable "splunk_hec_token" {
  description = "Splunk HEC authentication token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "splunk_index" {
  description = "Default Splunk index for log ingestion"
  type        = string
  default     = "ai_curator_logs"
}

variable "log_retention_days" {
  description = "CloudWatch Log Group retention in days"
  type        = number
  default     = 30

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653], var.log_retention_days)
    error_message = "Must be a valid CloudWatch Logs retention period."
  }
}

variable "enable_predictive_scaling" {
  description = "Enable predictive auto-scaling (requires ASG workers)"
  type        = bool
  default     = false
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for scaling event notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "domain_name" {
  description = "Domain name for Route53 hosted zone"
  type        = string
  default     = "ai-curator.example.com"
}

variable "cloudfront_secret" {
  description = "Shared secret for CloudFront origin verification"
  type        = string
  sensitive   = true
  default     = ""
}

variable "enable_redis_global" {
  description = "Enable global Redis (ElastiCache) replication"
  type        = bool
  default     = false
}

variable "enable_spot_instances" {
  description = "Enable advanced Fargate Spot capacity provider strategy (overrides base module)"
  type        = bool
  default     = false
}

variable "enable_edge_auth" {
  description = "Enable Lambda@Edge authentication for CloudFront"
  type        = bool
  default     = false
}
