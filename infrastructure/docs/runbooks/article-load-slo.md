# Runbook: Article Load SLO

**Alert names:** `ArticleLoadSLOBurnRateCritical`, `ArticleLoadSLOBurnRateWarning`
**SLO target:** 99.5 % of `/api/articles/**` requests return HTTP 2xx within 500 ms (30-day window)
**Error budget:** 0.5 % = ~3.6 hours / month

---

## Impact

Users cannot browse or load articles. Core product functionality is degraded.

---

## Immediate triage (< 5 min)

1. Check backend pod health:
   ```
   kubectl get pods -n ai-curator -l app=backend
   kubectl logs -n ai-curator -l app=backend --tail=100
   ```
2. Check MongoDB connectivity via the health endpoint:
   ```
   curl https://<backend-url>/health
   ```
3. Check error rate in Grafana → **SynthoraAI SLO Overview** → _Article Load_ row.
4. Check Istio / ingress for upstream errors:
   ```
   kubectl logs -n istio-system -l app=istiod --tail=50
   ```

---

## Common causes and fixes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| 5xx spike, DB `disconnected` in `/health` | MongoDB connection lost | Restart backend pods; check Atlas / Mongo network policies |
| High latency (>500 ms) on `/api/articles` | Large query or missing index | Check slow query logs in Atlas; run `EXPLAIN` on the relevant query |
| 404 spike | Route misconfiguration after deploy | Roll back the last backend deployment |
| Connection refused | Pod crash-looping | `kubectl describe pod <pod>` for OOMKill / startup errors |

---

## Escalation

- Page on-call if the critical alert fires and cannot be resolved within 15 min.
- Notify `#incidents` Slack channel with current error rate and affected endpoints.
