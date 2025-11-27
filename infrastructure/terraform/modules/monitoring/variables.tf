variable "environment" {
  description = "Environment name"
  type        = string
}

variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "services" {
  description = "Map of services to monitor"
  type = map(object({
    service_name = string
    alb_arn      = string
    target_group = string
  }))
}

variable "sns_topic_arn" {
  description = "ARN of SNS topic for alarms"
  type        = string
}

variable "cpu_high_threshold" {
  description = "Threshold for high CPU utilization alarm"
  type        = number
  default     = 80
}

variable "memory_high_threshold" {
  description = "Threshold for high memory utilization alarm"
  type        = number
  default     = 80
}

variable "response_time_threshold" {
  description = "Threshold for high response time alarm in seconds"
  type        = number
  default     = 2
}

variable "error_5xx_threshold" {
  description = "Threshold for 5XX errors count"
  type        = number
  default     = 10
}

variable "error_4xx_threshold" {
  description = "Threshold for 4XX errors count"
  type        = number
  default     = 100
}
