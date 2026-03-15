# Drift Hotspots

Use these as a starting point when auditing:

- `shell/` scripts versus root `package.json` and root `Makefile`
- `crawler/pages/api/scheduled/cleanArticles.ts` versus `crawler/scripts/cleanData.ts`
- `newsletters/Dockerfile` versus `newsletters/package.json`
- `frontend/services/api.ts` versus `frontend/pages/ai_chat.tsx`
- `backend` runtime docs versus `src/app.ts`, `src/server.ts`, and scheduled handlers
- `agentic_ai/README.md` and `Makefile` versus `mcp_server/app.py`
- `infrastructure/README.md` and `DEPLOYMENT.md` versus Terraform and Kubernetes manifests
