# Multi-Region Deployment Configuration
# This enables active-active deployment across multiple AWS regions

locals {
  regions = {
    primary = {
      name              = "us-east-1"
      cidr              = "10.0.0.0/16"
      availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
    }
    secondary = {
      name              = "us-west-2"
      cidr              = "10.1.0.0/16"
      availability_zones = ["us-west-2a", "us-west-2b", "us-west-2c"]
    }
    tertiary = {
      name              = "eu-west-1"
      cidr              = "10.2.0.0/16"
      availability_zones = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
    }
  }
}

# Route53 Health Checks
resource "aws_route53_health_check" "primary" {
  fqdn              = module.alb.dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"

  tags = {
    Name = "ai-curator-${var.environment}-primary-health-check"
  }
}

# Route53 Hosted Zone
resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = {
    Name = "ai-curator-${var.environment}"
  }
}

# Route53 Failover Records
resource "aws_route53_record" "primary" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  set_identifier = "primary"
  health_check_id = aws_route53_health_check.primary.id

  failover_routing_policy {
    type = "PRIMARY"
  }

  alias {
    name                   = module.alb.dns_name
    zone_id                = module.alb.zone_id
    evaluate_target_health = true
  }
}

# Global Accelerator for Multi-Region
resource "aws_globalaccelerator_accelerator" "main" {
  name            = "ai-curator-${var.environment}"
  ip_address_type = "IPV4"
  enabled         = true

  attributes {
    flow_logs_enabled   = true
    flow_logs_s3_bucket = aws_s3_bucket.global_accelerator_logs.id
    flow_logs_s3_prefix = "flow-logs/"
  }

  tags = {
    Name = "ai-curator-${var.environment}-accelerator"
  }
}

resource "aws_globalaccelerator_listener" "https" {
  accelerator_arn = aws_globalaccelerator_accelerator.main.id
  protocol        = "TCP"

  port_range {
    from_port = 443
    to_port   = 443
  }
}

resource "aws_globalaccelerator_endpoint_group" "us_east_1" {
  listener_arn = aws_globalaccelerator_listener.https.id
  endpoint_group_region = "us-east-1"
  traffic_dial_percentage = 100

  endpoint_configuration {
    endpoint_id = module.alb.alb_arn
    weight      = 100
  }

  health_check_interval_seconds = 30
  health_check_path            = "/health"
  health_check_port            = 443
  health_check_protocol        = "HTTPS"
  threshold_count              = 3
}

# S3 Bucket for Global Accelerator Logs
resource "aws_s3_bucket" "global_accelerator_logs" {
  bucket = "ai-curator-${var.environment}-ga-logs-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "ai-curator-${var.environment}-ga-logs"
  }
}

# Cross-Region Replication for S3
resource "aws_s3_bucket_replication_configuration" "replication" {
  depends_on = [aws_s3_bucket_versioning.source]

  role = aws_iam_role.replication.arn
  bucket = aws_s3_bucket.source.id

  rule {
    id     = "replicate-all"
    status = "Enabled"

    filter {}

    destination {
      bucket        = aws_s3_bucket.destination.arn
      storage_class = "STANDARD_IA"

      replication_time {
        status = "Enabled"
        time {
          minutes = 15
        }
      }

      metrics {
        status = "Enabled"
        event_threshold {
          minutes = 15
        }
      }
    }

    delete_marker_replication {
      status = "Enabled"
    }
  }
}

# DynamoDB Global Tables for Session Storage
resource "aws_dynamodb_table" "sessions" {
  name           = "ai-curator-${var.environment}-sessions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "sessionId"
  stream_enabled = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "sessionId"
    type = "S"
  }

  replica {
    region_name = "us-west-2"
  }

  replica {
    region_name = "eu-west-1"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "ai-curator-${var.environment}-sessions"
  }
}

# ElastiCache Global Datastore for Redis
resource "aws_elasticache_global_replication_group" "redis" {
  count = var.enable_redis_global ? 1 : 0

  global_replication_group_id_suffix = "ai-curator-${var.environment}"
  primary_replication_group_id       = aws_elasticache_replication_group.primary[0].id

  global_replication_group_description = "Global Redis for AI Curator ${var.environment}"
}

resource "aws_elasticache_replication_group" "primary" {
  count = var.enable_redis_global ? 1 : 0

  replication_group_id       = "ai-curator-${var.environment}-primary"
  replication_group_description = "Primary Redis cluster"
  engine                     = "redis"
  engine_version             = "7.0"
  node_type                  = "cache.r6g.large"
  num_cache_clusters         = 3
  port                       = 6379
  automatic_failover_enabled = true
  multi_az_enabled          = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  subnet_group_name = aws_elasticache_subnet_group.redis[0].name

  tags = {
    Name = "ai-curator-${var.environment}-redis-primary"
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  count = var.enable_redis_global ? 1 : 0

  name       = "ai-curator-${var.environment}-redis-subnet-group"
  subnet_ids = module.vpc.private_subnet_ids

  tags = {
    Name = "ai-curator-${var.environment}-redis-subnet-group"
  }
}

# CloudFront Distribution for Global Content Delivery
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "AI Curator ${var.environment} CDN"
  default_root_object = "index.html"
  price_class         = "PriceClass_All"

  origin {
    domain_name = module.alb.dns_name
    origin_id   = "ALB"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    custom_header {
      name  = "X-Custom-Header"
      value = var.cloudfront_secret
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "ALB"

    forwarded_values {
      query_string = true
      headers      = ["Host", "Authorization", "CloudFront-Forwarded-Proto"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true

    lambda_function_association {
      event_type   = "viewer-request"
      lambda_arn   = aws_lambda_function.edge_auth[0].qualified_arn
      include_body = false
    }
  }

  # Cache behavior for static assets
  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "ALB"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    min_ttl                = 86400
    default_ttl            = 604800
    max_ttl                = 31536000
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
  }

  # Cache behavior for API requests
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "ALB"

    forwarded_values {
      query_string = true
      headers      = ["*"]

      cookies {
        forward = "all"
      }
    }

    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  web_acl_id = var.enable_waf ? aws_wafv2_web_acl.cloudfront[0].arn : null

  logging_config {
    include_cookies = false
    bucket          = aws_s3_bucket.cloudfront_logs.bucket_domain_name
    prefix          = "cloudfront/"
  }

  tags = {
    Name = "ai-curator-${var.environment}-cdn"
  }
}

# S3 Bucket for CloudFront Logs
resource "aws_s3_bucket" "cloudfront_logs" {
  bucket = "ai-curator-${var.environment}-cloudfront-logs-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "ai-curator-${var.environment}-cloudfront-logs"
  }
}

# Lambda@Edge for Authentication
resource "aws_lambda_function" "edge_auth" {
  count = var.enable_edge_auth ? 1 : 0

  filename      = "edge-auth.zip"
  function_name = "ai-curator-${var.environment}-edge-auth"
  role          = aws_iam_role.edge_lambda[0].arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  publish       = true

  tags = {
    Name = "ai-curator-${var.environment}-edge-auth"
  }
}

resource "aws_iam_role" "edge_lambda" {
  count = var.enable_edge_auth ? 1 : 0

  name = "ai-curator-${var.environment}-edge-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "edgelambda.amazonaws.com"
          ]
        }
      }
    ]
  })
}
