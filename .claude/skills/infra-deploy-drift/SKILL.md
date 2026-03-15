---
name: infra-deploy-drift
description: Use this skill when changing infrastructure/, deployment scripts, Docker deployment assumptions, Terraform, Kubernetes manifests, monitoring, or rollout logic in this repository.
---

# Infrastructure Deploy Drift

This skill covers `infrastructure/` and deployment assumptions elsewhere in the repo.

## Working Rules

- Treat deploy changes as rollback-sensitive.
- Check scripts, manifests, and docs together before changing rollout logic.
- Call out placeholder secrets, hard-coded environments, mutable image tags, and missing health-check alignment.
- Prefer drift reduction and safer defaults over adding more wrapper complexity.

## Validation

- Read Terraform, Kubernetes, and the wrapper script for the same surface.
- Confirm whether a change affects ECS, Kubernetes, or both.

## References

- For files and known risks, read `references/infra-map.md`.
