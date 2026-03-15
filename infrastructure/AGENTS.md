# Infrastructure Guidance

- Treat deploy and rollout changes as rollback-sensitive.
- Check Terraform, Kubernetes, and wrapper scripts together before changing deployment assumptions.
- Watch for placeholder secrets, mutable `:latest` image tags, and hard-coded environment details.
- Prefer drift reduction and safer defaults over adding more wrappers.
