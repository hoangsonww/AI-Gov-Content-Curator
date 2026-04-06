# Splunk Integration Module
# Routes AWS CloudWatch Logs and ECS container logs to Splunk via Kinesis Data Firehose → Splunk HEC

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "splunk_hec_endpoint" {
  description = "Splunk HEC endpoint URL (e.g. https://splunk.example.com:8088)"
  type        = string
}

variable "splunk_hec_token" {
  description = "Splunk HEC authentication token"
  type        = string
  sensitive   = true
}

variable "vpc_id" {
  description = "VPC ID for VPC endpoint (optional)"
  type        = string
  default     = ""
}

variable "ecs_log_group_arns" {
  description = "Map of service name → CloudWatch Log Group ARN to subscribe to Splunk"
  type        = map(string)
  default     = {}
}

variable "ecs_log_group_names" {
  description = "Map of service name → CloudWatch Log Group name"
  type        = map(string)
  default     = {}
}

variable "s3_backup_bucket_name" {
  description = "S3 bucket for Firehose delivery failure backup"
  type        = string
  default     = ""
}

variable "enable_s3_backup" {
  description = "Enable S3 backup for failed Firehose deliveries"
  type        = bool
  default     = true
}

variable "splunk_index" {
  description = "Default Splunk index for ingested data"
  type        = string
  default     = "ai_curator_logs"
}

variable "buffering_interval" {
  description = "Firehose buffering interval in seconds"
  type        = number
  default     = 60
}

variable "buffering_size" {
  description = "Firehose buffering size in MB"
  type        = number
  default     = 5
}

variable "retry_duration" {
  description = "Firehose retry duration in seconds for Splunk delivery"
  type        = number
  default     = 300
}

variable "tags" {
  description = "Additional resource tags"
  type        = map(string)
  default     = {}
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarm notifications"
  type        = string
  default     = ""
}

locals {
  name_prefix = "ai-curator-${var.environment}"
  common_tags = merge(var.tags, {
    Module      = "splunk"
    Environment = var.environment
  })
}

# S3 bucket for Firehose failed delivery backup
resource "aws_s3_bucket" "firehose_backup" {
  count  = var.enable_s3_backup ? 1 : 0
  bucket = var.s3_backup_bucket_name != "" ? var.s3_backup_bucket_name : "${local.name_prefix}-splunk-firehose-backup"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-splunk-firehose-backup"
  })
}

resource "aws_s3_bucket_lifecycle_configuration" "firehose_backup" {
  count  = var.enable_s3_backup ? 1 : 0
  bucket = aws_s3_bucket.firehose_backup[0].id

  rule {
    id     = "expire-old-backups"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "firehose_backup" {
  count  = var.enable_s3_backup ? 1 : 0
  bucket = aws_s3_bucket.firehose_backup[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "firehose_backup" {
  count  = var.enable_s3_backup ? 1 : 0
  bucket = aws_s3_bucket.firehose_backup[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM Role for Kinesis Data Firehose
resource "aws_iam_role" "firehose" {
  name = "${local.name_prefix}-splunk-firehose"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "firehose" {
  name = "${local.name_prefix}-splunk-firehose-policy"
  role = aws_iam_role.firehose.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Backup"
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject"
        ]
        Resource = var.enable_s3_backup ? [
          aws_s3_bucket.firehose_backup[0].arn,
          "${aws_s3_bucket.firehose_backup[0].arn}/*"
        ] : ["*"]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:PutLogEvents",
          "logs:CreateLogGroup",
          "logs:CreateLogStream"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Sid    = "KMS"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "s3.*.amazonaws.com"
          }
        }
      }
    ]
  })
}

# IAM Role for CloudWatch Logs subscription filter
resource "aws_iam_role" "cloudwatch_to_firehose" {
  name = "${local.name_prefix}-cw-to-firehose"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "logs.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "cloudwatch_to_firehose" {
  name = "${local.name_prefix}-cw-to-firehose-policy"
  role = aws_iam_role.cloudwatch_to_firehose.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "firehose:PutRecord",
          "firehose:PutRecordBatch"
        ]
        Resource = aws_kinesis_firehose_delivery_stream.splunk.arn
      }
    ]
  })
}

# CloudWatch Log Group for Firehose errors
resource "aws_cloudwatch_log_group" "firehose_errors" {
  name              = "/aws/firehose/${local.name_prefix}-splunk"
  retention_in_days = 14

  tags = local.common_tags
}

resource "aws_cloudwatch_log_stream" "firehose_errors" {
  name           = "SplunkDelivery"
  log_group_name = aws_cloudwatch_log_group.firehose_errors.name
}

# Kinesis Data Firehose Delivery Stream → Splunk HEC
resource "aws_kinesis_firehose_delivery_stream" "splunk" {
  name        = "${local.name_prefix}-splunk"
  destination = "splunk"

  splunk_configuration {
    hec_endpoint               = var.splunk_hec_endpoint
    hec_token                  = var.splunk_hec_token
    hec_acknowledgment_timeout = 300
    hec_endpoint_type          = "Event"
    retry_duration             = var.retry_duration
    s3_backup_mode             = var.enable_s3_backup ? "FailedEventsOnly" : "AllEvents"

    buffering_interval = var.buffering_interval
    buffering_size     = var.buffering_size

    s3_configuration {
      role_arn           = aws_iam_role.firehose.arn
      bucket_arn         = var.enable_s3_backup ? aws_s3_bucket.firehose_backup[0].arn : "arn:aws:s3:::unused"
      prefix             = "splunk-failed/${var.environment}/"
      error_output_prefix = "splunk-errors/${var.environment}/"
      buffering_interval = 300
      buffering_size     = 5
      compression_format = "GZIP"

      cloudwatch_logging_options {
        enabled         = true
        log_group_name  = aws_cloudwatch_log_group.firehose_errors.name
        log_stream_name = aws_cloudwatch_log_stream.firehose_errors.name
      }
    }

    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = aws_cloudwatch_log_group.firehose_errors.name
      log_stream_name = aws_cloudwatch_log_stream.firehose_errors.name
    }

    processing_configuration {
      enabled = true

      processors {
        type = "Lambda"

        parameters {
          parameter_name  = "LambdaArn"
          parameter_value = "${aws_lambda_function.firehose_processor.arn}:$LATEST"
        }

        parameters {
          parameter_name  = "RoleArn"
          parameter_value = aws_iam_role.firehose.arn
        }

        parameters {
          parameter_name  = "BufferSizeInMBs"
          parameter_value = "3"
        }

        parameters {
          parameter_name  = "BufferIntervalInSeconds"
          parameter_value = "60"
        }
      }
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-splunk-firehose"
  })
}

# Lambda: Transform CloudWatch log records for Splunk-friendly format
resource "aws_lambda_function" "firehose_processor" {
  function_name = "${local.name_prefix}-splunk-firehose-processor"
  role          = aws_iam_role.firehose_processor_lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 60
  memory_size   = 128

  filename         = data.archive_file.firehose_processor.output_path
  source_code_hash = data.archive_file.firehose_processor.output_base64sha256

  environment {
    variables = {
      ENVIRONMENT  = var.environment
      SPLUNK_INDEX = var.splunk_index
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-splunk-firehose-processor"
  })
}

data "archive_file" "firehose_processor" {
  type        = "zip"
  output_path = "${path.module}/firehose-processor.zip"

  source {
    content  = <<-EOF
      const zlib = require('zlib');

      exports.handler = async (event) => {
        const output = event.records.map((record) => {
          const payload = Buffer.from(record.data, 'base64');

          let decompressed;
          try {
            decompressed = zlib.gunzipSync(payload);
          } catch (e) {
            decompressed = payload;
          }

          let parsed;
          try {
            parsed = JSON.parse(decompressed.toString('utf8'));
          } catch (e) {
            return {
              recordId: record.recordId,
              result: 'ProcessingFailed',
              data: record.data,
            };
          }

          if (parsed.messageType === 'CONTROL_MESSAGE') {
            return {
              recordId: record.recordId,
              result: 'Dropped',
              data: record.data,
            };
          }

          const logEvents = (parsed.logEvents || []).map((logEvent) => {
            return JSON.stringify({
              time: logEvent.timestamp / 1000,
              host: parsed.logGroup,
              source: parsed.logStream,
              sourcetype: 'aws:cloudwatch:logs',
              index: process.env.SPLUNK_INDEX || 'ai_curator_logs',
              event: {
                message: logEvent.message,
                log_group: parsed.logGroup,
                log_stream: parsed.logStream,
                owner: parsed.owner,
                environment: process.env.ENVIRONMENT,
              },
            });
          });

          const transformedPayload = logEvents.join('\n') + '\n';
          const encodedPayload = Buffer.from(transformedPayload, 'utf8').toString('base64');

          return {
            recordId: record.recordId,
            result: 'Ok',
            data: encodedPayload,
          };
        });

        return { records: output };
      };
    EOF
    filename = "index.js"
  }
}

resource "aws_iam_role" "firehose_processor_lambda" {
  name = "${local.name_prefix}-splunk-firehose-processor"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "firehose_processor_basic" {
  role       = aws_iam_role.firehose_processor_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_permission" "allow_firehose" {
  statement_id  = "AllowFirehoseInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.firehose_processor.function_name
  principal     = "firehose.amazonaws.com"
  source_arn    = aws_kinesis_firehose_delivery_stream.splunk.arn
}

# CloudWatch Subscription Filters: Forward each ECS service's logs to Firehose
resource "aws_cloudwatch_log_subscription_filter" "ecs_to_splunk" {
  for_each = var.ecs_log_group_names

  name            = "${local.name_prefix}-${each.key}-to-splunk"
  log_group_name  = each.value
  filter_pattern  = ""
  destination_arn = aws_kinesis_firehose_delivery_stream.splunk.arn
  role_arn        = aws_iam_role.cloudwatch_to_firehose.arn
}

# CloudWatch Alarms for Firehose health
resource "aws_cloudwatch_metric_alarm" "firehose_delivery_errors" {
  alarm_name          = "${local.name_prefix}-splunk-firehose-delivery-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DeliveryToSplunk.DataFreshness"
  namespace           = "AWS/Firehose"
  period              = 300
  statistic           = "Maximum"
  threshold           = 900
  alarm_description   = "Splunk Firehose delivery freshness exceeds 15 minutes"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []
  ok_actions          = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    DeliveryStreamName = aws_kinesis_firehose_delivery_stream.splunk.name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "firehose_throttling" {
  alarm_name          = "${local.name_prefix}-splunk-firehose-throttling"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ThrottledRecords"
  namespace           = "AWS/Firehose"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "Splunk Firehose is experiencing throttling"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []
  ok_actions          = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    DeliveryStreamName = aws_kinesis_firehose_delivery_stream.splunk.name
  }

  tags = local.common_tags
}
