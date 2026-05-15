# agentic-ai Helm Chart

Install:

```bash
helm upgrade --install agentic-ai infrastructure/helm/agentic-ai \
  --namespace ai-curator --create-namespace \
  --set image.tag=v1.0.0 \
  --set secretRef.name=agentic-ai-secrets
```

Render manifests for review without applying:

```bash
helm template agentic-ai infrastructure/helm/agentic-ai
```

Lint:

```bash
helm lint infrastructure/helm/agentic-ai
```

Production overrides should be supplied via `--values` files (e.g.
`values-prod.yaml`), never via inline `--set` for sensitive data.

## Components

| Component | Notes                                                  |
| --------- | ------------------------------------------------------ |
| api       | FastAPI HTTP service, HPA, PDB, ServiceMonitor.        |
| mcp       | MCP stdio server, replicas=1 by design (ADR 0002).     |
| networkPolicy | Limits ingress to mesh + monitoring; egress allowlist. |

## Secrets

Prefer `secretRef.name` pointing at a Secret managed by
External Secrets Operator / Sealed Secrets / Vault. The chart can also
create a placeholder Secret (`secret.create=true`), but never commit
populated values to git.
