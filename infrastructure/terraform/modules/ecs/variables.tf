variable "environment" {
  description = "Environment name"
  type        = string
}

variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "container_insights" {
  description = "Enable Container Insights"
  type        = bool
  default     = true
}

variable "capacity_provider_fargate" {
  description = "Enable FARGATE capacity provider"
  type        = bool
  default     = true
}

variable "capacity_provider_spot" {
  description = "Enable FARGATE_SPOT capacity provider"
  type        = bool
  default     = false
}
