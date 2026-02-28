---
name: infra-deploy-drift
description: Change or review infrastructure, deployment, or rollout logic in this repository. Use when work touches infrastructure/, Terraform, Kubernetes manifests, monitoring config, deployment wrappers, or environment-specific operational assumptions.
---

# Infrastructure Deploy Drift

Treat deployment changes as rollback-sensitive.

## Follow This Workflow

1. Identify whether the change affects Terraform, Kubernetes, or both.
2. Read the manifest/module and the wrapper script or doc that invokes it.
3. Call out placeholder secrets, mutable image tags, and hard-coded environment details.
4. Prefer safer defaults and drift reduction over adding more wrapper complexity.

## Use The References

- Read `references/infra-map.md` for key areas and current risks.
