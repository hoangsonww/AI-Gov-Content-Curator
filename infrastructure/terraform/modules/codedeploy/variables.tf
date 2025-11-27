variable "environment" {
  description = "Environment name"
  type        = string
}

variable "notification_email" {
  description = "Email for deployment notifications"
  type        = string
  default     = ""
}

variable "applications" {
  description = "Map of applications with their configurations"
  type = map(object({
    cluster_name            = string
    service_name            = string
    alb_listener_arn        = string
    target_group_blue       = string
    target_group_green      = string
    auto_rollback           = bool
    termination_wait_time   = number
    deployment_config_name  = optional(string, "CodeDeployDefault.ECSAllAtOnce")
    test_listener_arns      = optional(list(string), [])
    alarm_arns              = optional(list(string), [])
  }))
}
