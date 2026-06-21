# Runbook: Chat Response SLO

**Alert names:** `ChatSLOBurnRateCritical`, `ChatSLOBurnRateWarning`
**SLO target:** 99 % of `/api/chat` requests return HTTP 2xx (30-day window)
**Error budget:** 1 % = ~7.2 hours / month

---

## Impact

The AI chat feature is unavailable or returning errors. Users cannot ask questions about articles.

---

## Immediate triage (< 5 min)

1. Check backend logs for chat-specific errors:
   ```
   kubectl logs -n ai-curator -l app=backend --tail=100 | grep "/api/chat"
   ```
2. Verify Gemini API key and quota:
   - Check `GEMINI_API_KEY` is set in the backend secret.
   - Check Google Cloud Console → Vertex AI / Gemini API quota usage.
3. Check Pinecone vector search availability (chat uses RAG):
   - Verify `PINECONE_API_KEY` and index health in the Pinecone console.
4. Test the endpoint manually:
   ```
   curl -X POST https://<backend-url>/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"test","history":[]}'
   ```

---

## Common causes and fixes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| 429 from Gemini | Rate limit or quota exhausted | Wait for quota reset; check billing; reduce request rate |
| 500 with Pinecone timeout | Pinecone index overloaded or down | Check Pinecone status page; retry with exponential backoff |
| 500 with MongoDB error | Context fetch failing | Check MongoDB health; verify article collection is populated |
| Latency > 10 s consistently | Large context or slow model response | Reduce history window; switch to a faster model tier |

---

## Escalation

- The chat feature has external AI API dependencies with their own SLAs (Gemini, Pinecone). If the provider is down, post status in `#incidents` and wait for recovery.
- If errors originate in the backend code, page on-call and roll back the last deployment.
