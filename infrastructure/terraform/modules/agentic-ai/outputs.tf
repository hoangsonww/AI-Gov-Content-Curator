output "ecr_repository_url" {
  description = "ECR repository URL for the agentic-ai image."
  value       = aws_ecr_repository.this.repository_url
}

output "ecr_repository_arn" {
  description = "ECR repository ARN."
  value       = aws_ecr_repository.this.arn
}

output "kms_key_arn" {
  description = "KMS CMK ARN used for at-rest encryption."
  value       = aws_kms_key.this.arn
}

output "kms_key_alias" {
  description = "KMS alias for the agentic-ai key."
  value       = aws_kms_alias.this.name
}

output "secret_arns" {
  description = "Map of secret name -> ARN."
  value       = { for k, s in aws_secretsmanager_secret.this : k => s.arn }
}

output "secret_read_policy_arn" {
  description = "IAM policy ARN granting read access to the secrets."
  value       = aws_iam_policy.secret_read.arn
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name."
  value       = aws_cloudwatch_log_group.this.name
}

output "helm_release_name" {
  description = "Name of the Helm release, when deployed."
  value       = try(helm_release.this[0].name, null)
}
