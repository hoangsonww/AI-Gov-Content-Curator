variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "public_subnets" {
  description = "List of public subnet IDs"
  type        = list(string)
}

variable "certificate_arn" {
  description = "ARN of ACM certificate"
  type        = string
}

variable "enable_waf" {
  description = "Enable AWS WAF"
  type        = bool
  default     = true
}
