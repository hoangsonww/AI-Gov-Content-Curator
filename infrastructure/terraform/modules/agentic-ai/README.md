# Terraform module: agentic-ai

Provisions cloud foundations for the SynthoraAI agentic AI subsystem and
optionally installs the Helm chart into an existing EKS cluster.

## Resources

- **KMS CMK** with rotation, alias `alias/agentic-ai`.
- **ECR repository** with KMS encryption, image scanning, lifecycle
  policy (keep 30 tagged + expire untagged after 14d), default
  immutable tags.
- **Secrets Manager** entries for each secret key (LLM provider keys,
  Pinecone, MongoDB, Redis).
- **IAM policy** that workloads (IRSA / Workload Identity) attach to
  read the secrets.
- **CloudWatch log group** at `/synthora/<env>/<name>` with 30d
  retention and CMK encryption.
- Optional **Helm release** of the `agentic-ai` chart into a target
  EKS namespace.

## Usage

```hcl
module "agentic_ai" {
  source      = "../modules/agentic-ai"
  name        = "agentic-ai"
  environment = "production"
  region      = "us-east-1"
  tags        = local.tags

  # Install the Helm chart in the same plan.
  deploy_helm_release  = true
  kubernetes_namespace = "ai-curator"
  helm_chart_path      = "${path.module}/../../helm/agentic-ai"
  image_tag            = "v1.0.0"
  helm_values = {
    api = { replicaCount = 3 }
    env = {
      OTEL_TRACES_SAMPLE_RATIO = "0.1"
    }
  }
}
```

## Inputs

See `variables.tf` for the full list.

## Outputs

| Output                  | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `ecr_repository_url`    | Push target for the container image.           |
| `kms_key_arn`           | KMS CMK ARN for cross-resource references.     |
| `secret_arns`           | Map of secret-name → ARN.                      |
| `secret_read_policy_arn`| Attach to IRSA / Workload Identity.            |
| `cloudwatch_log_group`  | Use as `awslogs-group` for ECS/Fargate.        |
| `helm_release_name`     | Confirms the Helm release name when applied.   |

## Security notes

- Secrets in this module are scaffolding only — populate via Secrets
  Manager or a pipeline that has the credentials, never via tfvars
  committed to source control.
- ECR mutability defaults to `IMMUTABLE`. If your CI updates a moving
  tag (e.g. `latest`), set `ecr_image_tag_mutability = "MUTABLE"` — but
  prefer pinning to immutable digests in production.
- The KMS key cannot be deleted for 30 days after `destroy`.
