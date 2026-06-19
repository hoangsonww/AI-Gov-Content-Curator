# Runbook: Crawl Freshness SLO

**Alert names:** `CrawlFreshnessViolation`, `CrawlJobFailing`
**SLO target:** 95 % of 24-hour windows contain at least one successful crawl run
**Error budget:** 5 % = ~1.5 days / month without a fresh crawl

---

## Impact

Article content is stale. Users see old or missing articles. AI responses may be based on outdated information.

---

## Immediate triage (< 5 min)

1. Check the crawler CronJob status:
   ```
   kubectl get cronjobs -n ai-curator
   kubectl get jobs -n ai-curator --sort-by=.metadata.creationTimestamp | tail -5
   ```
2. Check crawler pod logs for the most recent job:
   ```
   kubectl logs -n ai-curator -l job-name=<latest-crawler-job> --tail=100
   ```
3. Check the `crawl_last_success_timestamp_seconds` gauge in Grafana → **SynthoraAI SLO Overview** → _Crawl Freshness_.
4. Manually trigger a crawl run to verify the issue:
   ```
   kubectl create job --from=cronjob/crawler manual-crawl-$(date +%s) -n ai-curator
   ```

---

## Common causes and fixes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Job never starts | CronJob schedule wrong or suspended | Check `kubectl get cronjob crawler -n ai-curator -o yaml`; verify `suspend: false` |
| Job starts, exits non-zero | Crawler code error or dependency down | Check logs; verify Gemini API key and MongoDB URI in secret |
| Job completes but metric not updated | `crawl_last_success_timestamp_seconds` not being set | Ensure the crawler calls the metrics update on success |
| Gemini 429 / quota | API rate limit during summarisation | Retry with backoff; check quota in Google Cloud Console |
| MongoDB write failure | Atlas storage full or network issue | Check Atlas metrics; free up space or increase tier |

---

## Escalation

- If crawl is failing for > 6 hours and manual trigger also fails, page on-call.
- Post in `#incidents` with the last successful crawl time and current error.
