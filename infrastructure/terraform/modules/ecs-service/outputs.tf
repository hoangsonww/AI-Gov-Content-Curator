output "service_id" {
  description = "ID of the ECS service"
  value       = aws_ecs_service.service.id
}

output "service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.service.name
}

output "service_arn" {
  description = "ARN of the ECS service"
  value       = aws_ecs_service.service.id
}

output "task_definition_arn" {
  description = "ARN of the task definition"
  value       = aws_ecs_task_definition.service.arn
}

output "security_group_id" {
  description = "Security group ID of the service"
  value       = aws_security_group.ecs_service.id
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
  value       = aws_cloudwatch_log_group.service.name
}
