output "firehose_delivery_stream_arn" {
  description = "ARN of the Kinesis Data Firehose delivery stream for Splunk"
  value       = aws_kinesis_firehose_delivery_stream.splunk.arn
}

output "firehose_delivery_stream_name" {
  description = "Name of the Kinesis Data Firehose delivery stream"
  value       = aws_kinesis_firehose_delivery_stream.splunk.name
}

output "firehose_role_arn" {
  description = "IAM role ARN used by Firehose"
  value       = aws_iam_role.firehose.arn
}

output "s3_backup_bucket_arn" {
  description = "ARN of the S3 bucket for failed delivery backup"
  value       = var.enable_s3_backup ? aws_s3_bucket.firehose_backup[0].arn : ""
}

output "firehose_processor_lambda_arn" {
  description = "ARN of the Lambda function that transforms logs for Splunk"
  value       = aws_lambda_function.firehose_processor.arn
}

output "cloudwatch_to_firehose_role_arn" {
  description = "IAM role ARN for CloudWatch to Firehose subscription"
  value       = aws_iam_role.cloudwatch_to_firehose.arn
}
