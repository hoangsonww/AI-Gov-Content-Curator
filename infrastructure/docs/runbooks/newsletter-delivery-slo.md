# Runbook: Newsletter Delivery SLO

**Alert names:** `NewsletterDeliveryFailure`, `NewsletterSLOAtRisk`
**SLO target:** 99 % of newsletter send attempts succeed (30-day rolling window)
**Error budget:** 1 % of sends — e.g., at 100 sends/month, 1 failure exhausts the budget

---

## Impact

Subscribers are not receiving their digest emails. This is a direct user-facing failure and a reputational risk.

---

## Immediate triage (< 5 min)

1. Check the newsletter CronJob and most recent job logs:
   ```
   kubectl get cronjobs -n ai-curator
   kubectl logs -n ai-curator -l job-name=<latest-newsletter-job> --tail=100
   ```
2. Check Resend API status at https://resend.com/status
3. Verify the `RESEND_API_KEY` secret is valid and not expired:
   ```
   kubectl get secret -n ai-curator backend-secrets -o jsonpath='{.data.RESEND_API_KEY}' | base64 -d
   ```
4. Check `newsletter_sends_total` counters in Grafana → **SynthoraAI SLO Overview** → _Newsletter Delivery_.

---

## Common causes and fixes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Resend 401 / 403 | API key invalid or revoked | Rotate key in Resend dashboard; update k8s secret |
| Resend 429 | Rate limit exceeded | Implement send batching with delay; check Resend plan limits |
| Empty subscriber list | DB query returning no results | Check `NewsletterSubscriber` collection; verify `isSubscribed` field |
| MongoDB connection error | Atlas down or network policy blocking job pod | Check Atlas status; verify network policy allows newsletter namespace |
| Job succeeds but emails not delivered | Resend accepted but bounced | Check Resend delivery logs in the dashboard for bounce/spam reasons |

---

## Escalation

- A single failure (`NewsletterDeliveryFailure`) fires immediately — investigate before the next scheduled send.
- If Resend is confirmed down, post in `#incidents`, notify stakeholders that the send is delayed, and retry manually once Resend recovers.
- For repeated failures, consider a fallback SMTP provider and open a ticket.
