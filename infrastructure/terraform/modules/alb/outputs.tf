output "alb_arn" {
  description = "ARN of the ALB"
  value       = aws_lb.main.arn
}

output "alb_arn_suffix" {
  description = "ARN suffix of the ALB"
  value       = aws_lb.main.arn_suffix
}

output "dns_name" {
  description = "DNS name of the ALB"
  value       = aws_lb.main.dns_name
}

output "zone_id" {
  description = "Zone ID of the ALB"
  value       = aws_lb.main.zone_id
}

output "security_group_id" {
  description = "Security group ID of the ALB"
  value       = aws_security_group.alb.id
}

output "http_listener_arn" {
  description = "ARN of HTTP listener"
  value       = aws_lb_listener.http.arn
}

output "https_listener_arn" {
  description = "ARN of HTTPS listener"
  value       = aws_lb_listener.https.arn
}

output "backend_target_group_arn" {
  description = "ARN of backend blue target group"
  value       = aws_lb_target_group.backend_blue.arn
}

output "backend_target_group_arn_suffix" {
  description = "ARN suffix of backend blue target group"
  value       = aws_lb_target_group.backend_blue.arn_suffix
}

output "backend_target_group_green_arn" {
  description = "ARN of backend green target group"
  value       = aws_lb_target_group.backend_green.arn
}

output "frontend_target_group_arn" {
  description = "ARN of frontend blue target group"
  value       = aws_lb_target_group.frontend_blue.arn
}

output "frontend_target_group_arn_suffix" {
  description = "ARN suffix of frontend blue target group"
  value       = aws_lb_target_group.frontend_blue.arn_suffix
}

output "frontend_target_group_green_arn" {
  description = "ARN of frontend green target group"
  value       = aws_lb_target_group.frontend_green.arn
}
