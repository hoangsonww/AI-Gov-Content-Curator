# Infrastructure Map

## Key Areas

- `infrastructure/terraform/`
- `infrastructure/kubernetes/`
- `infrastructure/scripts/`
- `infrastructure/README.md`
- `infrastructure/DEPLOYMENT.md`

## Commands

- `make terraform-plan`
- `make terraform-apply`
- `make aws-deploy`
- `make k8s-deploy-all`

## Known Risks

- placeholder secrets
- mutable `:latest` images
- hard-coded environment details
- docs and manifests drifting apart
