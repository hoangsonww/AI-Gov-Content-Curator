# Chat Surface

## Backend Files

- `backend/src/routes/chat.routes.ts`
- `backend/src/controllers/chat.controller.ts`
- `backend/src/services/pinecone.service.ts`
- `backend/src/services/geminiModels.service.ts`

## Repository Docs

- `RAG_CHATBOT.md`
- `CHATBOT_GUARDRAILS.md`

## What To Preserve

- SSE event flow for `status`, `context`, `citations`, `chunk`, `warnings`, and `done`
- citation numbering and metadata shape
- hallucination checks
- prompt budget controls and history trimming
- fallback model and key rotation behavior

## Failure Modes To Watch

- broken streaming headers or response flushing
- invalid citation numbers or citation rendering drift
- Pinecone search returning mismatched metadata
- prompt growth causing truncation or poor source grounding
