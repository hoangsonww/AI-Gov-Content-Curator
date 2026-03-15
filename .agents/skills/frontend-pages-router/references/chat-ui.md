# Chat UI

The sitewide chat UI lives in `frontend/pages/ai_chat.tsx`.

Preserve:

- SSE request and parsing flow
- chunk assembly
- citation link generation and scrolling
- warning banner handling
- conversation persistence in localStorage

Cross-check with:

- `RAG_CHATBOT.md`
- `CHATBOT_GUARDRAILS.md`
