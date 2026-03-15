# Documentation Map

Use these files when you need project context beyond the code:

- `README.md`: broad monorepo overview, service map, feature descriptions
- `ARCHITECTURE.md`: production topology, deployment patterns, system responsibilities
- `RAG_CHATBOT.md`: sitewide chat flow, SSE contract, Pinecone-backed retrieval
- `CHATBOT_GUARDRAILS.md`: citation system and hallucination checks
- `backend/README.md`: backend responsibilities and local setup
- `frontend/README.md`: frontend routes and UX notes
- `crawler/README.md`: ingestion flow and crawler assumptions
- `newsletters/README.md`: digest job intent and send behavior
- `agentic_ai/README.md`: Python pipeline and MCP server design
- `infrastructure/README.md` and `infrastructure/DEPLOYMENT.md`: deploy and ops context

When docs disagree with current code, trust `package.json`, `vercel.json`, Dockerfiles, route files, and implementation.
