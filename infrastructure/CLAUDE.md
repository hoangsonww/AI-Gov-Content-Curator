# Infrastructure Memory

This directory controls deployment and operations for AWS ECS, Kubernetes, monitoring, and Terraform.

## What Matters

- Terraform: `terraform/`
- Kubernetes: `kubernetes/`
- Wrapper scripts: `scripts/`
- Docs: `README.md` and `DEPLOYMENT.md`

## Guardrails

- Treat secrets, image tags, rollout configs, autoscaling rules, and backend state storage as sensitive.
- Check for placeholders such as `REPLACE_ME`, mutable `:latest` images, and hard-coded environment details.
- Do not claim deploy readiness without checking both manifests and scripts.
- Prefer drift detection, validation, and documented rollback steps over casual edits.

## Useful Commands

- `make terraform-plan`
- `make terraform-apply`
- `make aws-deploy`
- `make k8s-deploy-all`
