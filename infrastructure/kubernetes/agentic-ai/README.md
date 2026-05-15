# Agentic AI — Kubernetes Manifests

Apply with kustomize:

```bash
kubectl apply -k infrastructure/kubernetes/agentic-ai
```

## Topology

- **agentic-ai-api** — FastAPI HTTP service, the only deployed workload.
  Horizontally scaled via HPA. Serves `/process`, `/analyze`, `/batch`,
  `/healthz`, `/readyz`, `/metrics`.

The **MCP server is not deployed here.** It uses stdio transport
(ADR 0002) and is launched on demand by an MCP client — it is not a
long-running cluster workload. The shared image
(`ghcr.io/hoangsonww/ai-curator-agentic-ai`) still ships
`python -m mcp_server` for clients that run it in a container.

## Security defaults

- Non-root user (10001), read-only root fs, dropped capabilities,
  `seccompProfile: RuntimeDefault`.
- `automountServiceAccountToken: false`.
- NetworkPolicy limits ingress to mesh + monitoring, egress to DNS,
  Redis, OTLP telemetry, and HTTPS to the public internet (LLM
  providers) excluding RFC1918.
- Secrets sourced from a secret manager. The `secret.yaml` here is a
  template; replace via External Secrets Operator / Sealed Secrets.

## Observability

- Prometheus `ServiceMonitor` (`kube-prometheus-stack` release label).
- Pods export OTLP traces to the node-local Splunk OTel Collector
  DaemonSet via `http://$(HOST_IP):4317` (downward-API host IP).

## Overrides

To pin a specific image tag without editing the deployment manifest:

```bash
kustomize edit set image ghcr.io/hoangsonww/ai-curator-agentic-ai=ghcr.io/hoangsonww/ai-curator-agentic-ai:v1.2.3
```
