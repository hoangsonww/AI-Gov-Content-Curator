variable "name" {
  description = "Logical name used for AWS resources and Helm release."
  type        = string
  default     = "agentic-ai"
}

variable "environment" {
  description = "Deployment environment (development | staging | production)."
  type        = string
  default     = "production"
  validation {
    condition     = contains(["development", "staging", "production", "test"], var.environment)
    error_message = "environment must be one of: development, staging, production, test."
  }
}

variable "region" {
  description = "AWS region for ECR, Secrets Manager, and KMS."
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Tags applied to every AWS resource."
  type        = map(string)
  default     = {}
}

variable "ecr_repository_name" {
  description = "ECR repository name for the agentic-ai image."
  type        = string
  default     = "synthora/agentic-ai"
}

variable "ecr_image_scan_on_push" {
  description = "Enable ECR image vulnerability scanning."
  type        = bool
  default     = true
}

variable "ecr_image_tag_mutability" {
  description = "ECR tag mutability — IMMUTABLE is the production default."
  type        = string
  default     = "IMMUTABLE"
  validation {
    condition     = contains(["MUTABLE", "IMMUTABLE"], var.ecr_image_tag_mutability)
    error_message = "ecr_image_tag_mutability must be MUTABLE or IMMUTABLE."
  }
}

variable "kms_key_alias" {
  description = "KMS key alias for encryption at rest (ECR + Secrets Manager)."
  type        = string
  default     = "alias/agentic-ai"
}

variable "secret_keys" {
  description = "List of secret names that should exist in AWS Secrets Manager."
  type        = list(string)
  default = [
    "google_ai_api_key",
    "openai_api_key",
    "anthropic_api_key",
    "cohere_api_key",
    "pinecone_api_key",
    "mongodb_uri",
    "redis_password",
  ]
}

# ── Optional Helm release into an existing EKS cluster ────────────────────

variable "deploy_helm_release" {
  description = "Set true to install the agentic-ai Helm chart via Terraform."
  type        = bool
  default     = false
}

variable "kubernetes_namespace" {
  description = "Namespace for the Helm release when deploy_helm_release=true."
  type        = string
  default     = "ai-curator"
}

variable "helm_chart_path" {
  description = "Local path to the agentic-ai Helm chart."
  type        = string
  default     = "../../helm/agentic-ai"
}

variable "image_tag" {
  description = "Image tag to deploy. If empty, defaults to the chart's appVersion."
  type        = string
  default     = ""
}

variable "helm_values" {
  description = "Extra Helm values merged on top of the chart defaults."
  type        = any
  default     = {}
}
