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

- placeholder secrets such as `REPLACE_ME`
- mutable `:latest` images
- hard-coded backend state or environment details
- docs and manifests drifting apart
- autoscaling references to external artifacts that may not exist in the repo
