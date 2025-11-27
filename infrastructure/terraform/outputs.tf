output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = module.alb.zone_id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs_cluster.cluster_name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = module.ecs_cluster.cluster_arn
}

output "backend_service_name" {
  description = "Name of the backend ECS service"
  value       = module.backend_service.service_name
}

output "frontend_service_name" {
  description = "Name of the frontend ECS service"
  value       = module.frontend_service.service_name
}

output "backend_codedeploy_app" {
  description = "CodeDeploy application name for backend"
  value       = module.codedeploy.application_names["backend"]
}

output "frontend_codedeploy_app" {
  description = "CodeDeploy application name for frontend"
  value       = module.codedeploy.application_names["frontend"]
}

output "backend_codedeploy_deployment_group" {
  description = "CodeDeploy deployment group for backend"
  value       = module.codedeploy.deployment_group_names["backend"]
}

output "frontend_codedeploy_deployment_group" {
  description = "CodeDeploy deployment group for frontend"
  value       = module.codedeploy.deployment_group_names["frontend"]
}

output "cloudwatch_dashboard_url" {
  description = "URL to CloudWatch dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${module.monitoring.dashboard_name}"
}

output "sns_topic_arn" {
  description = "ARN of SNS topic for alerts"
  value       = aws_sns_topic.alerts.arn
}
