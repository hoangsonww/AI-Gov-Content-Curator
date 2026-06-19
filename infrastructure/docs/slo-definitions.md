# SynthoraAI — SLO Definitions

> Status: **Proposed** — pending lead-engineer approval before enforcement begins.
> Owner: Platform / on-call team
> Review cadence: Quarterly

---

## Summary table

| Journey | SLI definition | Target | Window | Error budget |
|---------|---------------|--------|--------|-------------|
| Article load | % of `/api/articles/**` requests that return HTTP 2xx **and** complete in < 500 ms | **99.5 %** | 30 days | ~3.6 h / month |
| Chat response | % of `/api/chat` requests that return HTTP 2xx | **99.0 %** | 30 days | ~7.2 h / month |
| Crawl freshness | % of 24-hour windows that contain ≥ 1 successful crawl run | **95.0 %** | 30 days | ~1.5 days / month |
| Newsletter delivery | % of newsletter send attempts that succeed (accepted by Resend) | **99.0 %** | 30 days | ~1 % of sends |

---

## 1. Article Load

### Why this journey
Browsing and loading articles is the primary action on the platform. Failures here directly block all users.

### SLI
```
good_requests = http_requests_total{route="/api/articles/**", status=~"2..", latency<500ms}
total_requests = http_requests_total{route="/api/articles/**"}
SLI = good_requests / total_requests
```

### SLO
**99.5 %** over a rolling 30-day window.

### Error budget
0.5 % × 30 × 24 × 60 = **216 minutes (~3.6 hours)** per month.

### Burn-rate alert thresholds
| Severity | Short window | Long window | Burn rate | Budget consumed |
|----------|-------------|-------------|-----------|-----------------|
| Critical (page) | 5 m | 1 h | 14.4× | 2 % in 1 h |
| Warning (ticket) | 30 m | 6 h | 6× | 5 % in 6 h |

### Runbook
[infrastructure/docs/runbooks/article-load-slo.md](runbooks/article-load-slo.md)

---

## 2. Chat Response Success

### Why this journey
The AI chat is a key differentiator. Failures degrade trust and reduce engagement, but the feature depends on external AI APIs (Gemini, Pinecone) with their own SLAs, justifying a slightly looser target.

### SLI
```
good_requests = http_requests_total{route="/api/chat", status=~"2.."}
total_requests = http_requests_total{route="/api/chat"}
SLI = good_requests / total_requests
```

_Latency excluded from the SLI definition because AI inference is variable; latency is tracked separately as a supplementary metric._

### SLO
**99.0 %** over a rolling 30-day window.

### Error budget
1 % × 30 × 24 × 60 = **432 minutes (~7.2 hours)** per month.

### Burn-rate alert thresholds
Same multi-window structure as Article Load, with a 1 % base error rate.

### Runbook
[infrastructure/docs/runbooks/chat-slo.md](runbooks/chat-slo.md)

---

## 3. Crawl Freshness

### Why this journey
Article freshness is the backbone of platform value. Stale content degrades AI chat quality and article relevance. A daily crawl window is the right granularity given the scheduled job cadence.

### SLI
```
SLI = fraction of 24-hour windows where
      (time() - crawl_last_success_timestamp_seconds) ≤ 86400 s
```

The `crawl_last_success_timestamp_seconds` gauge is updated by the crawler on each successful run completion.

### SLO
**95.0 %** of 24-hour windows over a rolling 30-day period.

### Error budget
5 % × 30 days = **~1.5 days** per month where a crawl can be missing or late.

### Alerts
- **CrawlFreshnessViolation** (critical): fires when `time() - crawl_last_success_timestamp_seconds > 90000` (25 h, giving 1 h buffer beyond the 24 h window).
- **CrawlJobFailing** (warning): fires when 2+ failures accumulate within 6 hours.

### Runbook
[infrastructure/docs/runbooks/crawl-freshness-slo.md](runbooks/crawl-freshness-slo.md)

---

## 4. Newsletter Delivery

### Why this journey
Newsletter sends are a committed communication to subscribers. A failure is directly visible to users and carries reputational risk.

### SLI
```
good_sends = newsletter_sends_total{status="success"}
total_sends = newsletter_sends_total
SLI = good_sends / total_sends  (rolling 30-day increase)
```

### SLO
**99.0 %** of send attempts succeed over a rolling 30-day window.

### Error budget
At a typical volume of ~100 sends/month: **~1 send failure** per month before the budget is exhausted.

### Alerts
- **NewsletterDeliveryFailure** (critical): fires immediately on any failure — every failure is high signal at this volume.
- **NewsletterSLOAtRisk** (warning): fires when the 30-day error ratio exceeds 0.5 % (budget > 50 % consumed).

### Runbook
[infrastructure/docs/runbooks/newsletter-delivery-slo.md](runbooks/newsletter-delivery-slo.md)

---

## Prometheus implementation

Recording rules and alerts are defined in:
- [`infrastructure/kubernetes/monitoring/slo-rules.yaml`](../kubernetes/monitoring/slo-rules.yaml)

The Grafana on-call dashboard is at:
- [`infrastructure/kubernetes/monitoring/slo-dashboard.yaml`](../kubernetes/monitoring/slo-dashboard.yaml)
- Dashboard title in Grafana: **SynthoraAI — SLO Overview**

Backend metrics are emitted via `prom-client` from `backend/src/middleware/metrics.middleware.ts` and scraped at `/metrics`.
