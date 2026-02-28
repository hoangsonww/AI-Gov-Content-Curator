# Chat UI Notes

The sitewide chat UI lives in `frontend/pages/ai_chat.tsx`.

Preserve:

- streaming request flow
- chunk assembly
- citation link generation and scrolling
- warning banner handling
- conversation persistence in localStorage
- markdown rendering behavior

Cross-check against:

- `RAG_CHATBOT.md`
- `CHATBOT_GUARDRAILS.md`

Typical regressions:

- broken SSE parsing
- citations no longer map to rendered source cards
- hydration issues from browser-only state
- changed API URL behavior only in one chat code path
