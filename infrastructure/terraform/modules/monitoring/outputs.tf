output "dashboard_name" {
  description = "Name of CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "dashboard_arn" {
  description = "ARN of CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_arn
}

output "cpu_alarm_names" {
  description = "Names of CPU utilization alarms"
  value       = { for k, v in aws_cloudwatch_metric_alarm.cpu_high : k => v.alarm_name }
}

output "memory_alarm_names" {
  description = "Names of memory utilization alarms"
  value       = { for k, v in aws_cloudwatch_metric_alarm.memory_high : k => v.alarm_name }
}

output "composite_alarm_names" {
  description = "Names of composite service health alarms"
  value       = { for k, v in aws_cloudwatch_composite_alarm.service_unhealthy : k => v.alarm_name }
}
