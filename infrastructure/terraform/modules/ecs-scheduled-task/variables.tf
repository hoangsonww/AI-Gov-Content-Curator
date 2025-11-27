variable "environment" {
  description = "Environment name"
  type        = string
}

variable "task_name" {
  description = "Name of the scheduled task"
  type        = string
}

variable "cluster_arn" {
  description = "ARN of the ECS cluster"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "private_subnets" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "task_cpu" {
  description = "CPU units for the task"
  type        = number
}

variable "task_memory" {
  description = "Memory for the task in MB"
  type        = number
}

variable "container_image" {
  description = "Docker image for the container"
  type        = string
}

variable "schedule_expression" {
  description = "Schedule expression (cron or rate)"
  type        = string
}

variable "enabled" {
  description = "Enable the scheduled task"
  type        = bool
  default     = true
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

variable "secrets" {
  description = "Secrets from Parameter Store"
  type = list(object({
    name      = string
    valueFrom = string
  }))
  default = []
}
