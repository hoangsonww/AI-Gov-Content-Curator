variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
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
  default     = "ghcr.io/hoangsonww/ai-curator-backend:latest"
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
  default     = "ghcr.io/hoangsonww/ai-curator-frontend:latest"
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
  default     = "ghcr.io/hoangsonww/ai-curator-crawler:latest"
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
  default     = "ghcr.io/hoangsonww/ai-curator-newsletters:latest"
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
