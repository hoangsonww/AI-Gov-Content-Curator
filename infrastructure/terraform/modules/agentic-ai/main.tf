locals {
  common_tags = merge(
    {
      "app.kubernetes.io/name" = "agentic-ai"
      "synthora:component"     = "agentic-ai"
      "synthora:environment"   = var.environment
      "managed-by"             = "terraform"
    },
    var.tags,
  )
}

# ── KMS key for at-rest encryption ────────────────────────────────────────

resource "aws_kms_key" "this" {
  description             = "Encryption key for ${var.name} (ECR + Secrets Manager)"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  tags                    = local.common_tags
}

resource "aws_kms_alias" "this" {
  name          = var.kms_key_alias
  target_key_id = aws_kms_key.this.key_id
}

# ── ECR repository ────────────────────────────────────────────────────────

resource "aws_ecr_repository" "this" {
  name                 = var.ecr_repository_name
  image_tag_mutability = var.ecr_image_tag_mutability
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = var.ecr_image_scan_on_push
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.this.arn
  }

  tags = local.common_tags
}

resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 30 tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 30
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Expire untagged after 14d"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = { type = "expire" }
      },
    ]
  })
}

# ── Secrets Manager scaffolding ───────────────────────────────────────────

resource "aws_secretsmanager_secret" "this" {
  for_each = toset(var.secret_keys)

  name                    = "${var.environment}/${var.name}/${each.value}"
  description             = "Secret '${each.value}' for ${var.name} (${var.environment})"
  kms_key_id              = aws_kms_key.this.arn
  recovery_window_in_days = 7
  tags                    = local.common_tags
}

# IAM policy that workload identity (IRSA / Workload Identity) can attach
# to pull secrets at runtime. Permission boundaries belong upstream.
resource "aws_iam_policy" "secret_read" {
  name        = "${var.name}-${var.environment}-secret-read"
  description = "Read access to ${var.name} secrets"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
      ]
      Resource = [for s in aws_secretsmanager_secret.this : s.arn]
    }]
  })
  tags = local.common_tags
}

# ── CloudWatch log group (for non-EKS deployments) ────────────────────────

resource "aws_cloudwatch_log_group" "this" {
  name              = "/synthora/${var.environment}/${var.name}"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.this.arn
  tags              = local.common_tags
}

# ── Optional Helm release ─────────────────────────────────────────────────

resource "helm_release" "this" {
  count = var.deploy_helm_release ? 1 : 0

  name             = var.name
  chart            = var.helm_chart_path
  namespace        = var.kubernetes_namespace
  create_namespace = true
  atomic           = true
  cleanup_on_fail  = true
  timeout          = 600
  wait             = true

  values = [
    yamlencode(merge(
      {
        image = {
          repository = "${aws_ecr_repository.this.repository_url}"
          tag        = var.image_tag
        }
        env = {
          ENVIRONMENT = var.environment
        }
      },
      var.helm_values,
    )),
  ]

  depends_on = [aws_ecr_repository.this]
}
