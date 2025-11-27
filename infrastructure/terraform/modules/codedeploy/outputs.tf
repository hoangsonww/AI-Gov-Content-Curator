output "application_names" {
  description = "Names of CodeDeploy applications"
  value       = { for k, v in aws_codedeploy_app.app : k => v.name }
}

output "deployment_group_names" {
  description = "Names of CodeDeploy deployment groups"
  value       = { for k, v in aws_codedeploy_deployment_group.deployment_group : k => v.deployment_group_name }
}

output "codedeploy_role_arn" {
  description = "ARN of CodeDeploy IAM role"
  value       = aws_iam_role.codedeploy.arn
}

output "sns_topic_arn" {
  description = "ARN of SNS topic for deployment notifications"
  value       = aws_sns_topic.deployment_notifications.arn
}

output "canary_deployment_config_name" {
  description = "Name of canary deployment config"
  value       = aws_codedeploy_deployment_config.canary_10_percent_5_minutes.deployment_config_name
}

output "linear_deployment_config_name" {
  description = "Name of linear deployment config"
  value       = aws_codedeploy_deployment_config.linear_10_percent_1_minute.deployment_config_name
}

output "all_at_once_deployment_config_name" {
  description = "Name of all-at-once deployment config"
  value       = aws_codedeploy_deployment_config.all_at_once.deployment_config_name
}
