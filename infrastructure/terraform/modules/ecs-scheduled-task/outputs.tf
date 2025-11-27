output "task_definition_arn" {
  description = "ARN of the task definition"
  value       = aws_ecs_task_definition.task.arn
}

output "security_group_id" {
  description = "Security group ID of the task"
  value       = aws_security_group.task.id
}

output "task_role_arn" {
  description = "ARN of the task IAM role"
  value       = aws_iam_role.ecs_task.arn
}

output "task_execution_role_arn" {
  description = "ARN of the task execution IAM role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "log_group_name" {
  description = "Name of CloudWatch log group"
  value       = aws_cloudwatch_log_group.task.name
}

output "event_rule_arn" {
  description = "ARN of the EventBridge rule"
  value       = aws_cloudwatch_event_rule.scheduled_task.arn
}
