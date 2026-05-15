# Agentic AI — Kubernetes Manifests

Apply with kustomize:

```bash
kubectl apply -k infrastructure/kubernetes/agentic-ai
```

## Topology

- **agentic-ai-api** — FastAPI HTTP service. Horizontally scaled via
  HPA. Replicas serve `/process`, `/analyze`, `/batch`, `/healthz`,
  `/readyz`, `/metrics`.
- **agentic-ai-mcp** — MCP server using stdio. Single replica;
  horizontal scale-out requires HTTP transport (ADR 0002).

## Security defaults

- Non-root user (10001), read-only root fs, dropped capabilities,
  `seccompProfile: RuntimeDefault`.
- `automountServiceAccountToken: false`.
- NetworkPolicy limits ingress to mesh + monitoring, egress to DNS,
  Redis, OTel collector, and HTTPS to the public internet (LLM
  providers) excluding RFC1918.
- Secrets sourced from a secret manager. The `secret.yaml` here is a
  template; replace via External Secrets Operator / Sealed Secrets.

## Observability

- Prometheus `ServiceMonitor` (`kube-prometheus-stack` release label).
- OTel collector targeted at
  `otel-collector.monitoring.svc.cluster.local:4317`.

## Overrides

To pin a specific image tag without editing the deployment manifest:

```bash
kustomize edit set image ghcr.io/hoangsonww/ai-curator-agentic-ai=ghcr.io/hoangsonww/ai-curator-agentic-ai:v1.2.3
```
