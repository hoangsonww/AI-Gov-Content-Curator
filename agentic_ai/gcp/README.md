# GCP Cloud Functions Adapter

Entrypoints for deploying the agentic pipeline as Google Cloud Functions.

## Files

- `cloud_function.py` — HTTP + Pub/Sub handlers.

## Install

Use the `cloud-gcp` extras profile:

```bash
pip install -r requirements/cloud-gcp.txt
# or
pip install -e ".[cloud-gcp]"
```

## Deploy

HTTP function:

```bash
gcloud functions deploy synthora-process-article \
  --gen2 --runtime=python311 --region=us-central1 \
  --entry-point=process_article \
  --source=. \
  --trigger-http \
  --no-allow-unauthenticated \
  --set-env-vars=ENVIRONMENT=production,DEFAULT_LLM_PROVIDER=google
```

Pub/Sub function:

```bash
gcloud functions deploy synthora-process-article-pubsub \
  --gen2 --runtime=python311 --region=us-central1 \
  --entry-point=process_pubsub \
  --source=. \
  --trigger-topic=synthora-articles
```

## Observability

The handler configures OpenTelemetry on cold start. Set
`OTEL_EXPORTER_OTLP_ENDPOINT` to your collector (Tempo / Honeycomb /
Grafana Cloud) or install `opentelemetry-exporter-gcp-trace` to ship
traces to Cloud Trace.

Logs are emitted as JSON to stderr; Cloud Logging captures them
automatically. Trace correlation is included when an OTel exporter is
configured.

## Result persistence

If `GCP_STORAGE_BUCKET` is set, Pub/Sub results are persisted to
`gs://<bucket>/results/<article_id>.json` using application default
credentials (managed identity recommended via the Cloud Function's
service account).
