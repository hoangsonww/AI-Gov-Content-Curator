# Security Notes — Agentic Pipeline + MCP Server

## Threat model

| Threat                                       | Control                                  |
| -------------------------------------------- | ---------------------------------------- |
| Leaked API key in logs                       | `SecretStr` + structlog redaction processor |
| Prompt injection via article content         | Length caps + per-agent prompt templates  |
| Resource exhaustion via giant payloads       | `MCP_MAX_*` settings enforced in validators |
| Retry storm against slow upstreams           | Circuit breakers per provider             |
| Denial of service via tool flooding          | Token-bucket rate limiter in middleware   |
| Dependency CVEs                              | `pip-audit` in CI + Trivy on image        |
| Container privilege escalation               | Non-root user, `no-new-privileges`, dropped caps, read-only fs |
| Outbound exfiltration of secrets             | Egress allowlists at network layer (out of scope here) |

## Secrets handling

- All API keys flow through `Settings` as `SecretStr`. Their string
  representation is `'**********'` — they do not leak when accidentally
  formatted.
- The logging stack passes every record through
  `mcp_server.security.structlog_redact_processor`, which both:
  1. Masks values for keys matching secret-shaped patterns
     (`api_key`, `token`, `password`, etc.).
  2. Masks inline values that match secret-shaped regexes
     (`sk-...`, `AKIA...`, JWTs, Bearer tokens).
- Container build does **not** bake secrets in. `.env` files are listed
  in `.dockerignore`.
- Compose uses `${VAR:?...}` for sensitive vars so missing values fail
  fast in production.

## Input validation

- `mcp_server/validation.py` enforces content + metadata size caps.
- `mcp_server/security.py` provides:
  - `normalize_text(max_length=...)` — strips control chars, NFKC.
  - `safe_identifier(...)` — sanitizes IDs for logs/metrics/spans.
  - `assert_in_allowlist(...)` — enforces enum-style fields.
- Pydantic models (`ArticleProcessRequest`, etc.) use `extra="forbid"`.

## Authentication

- MCP stdio transport delegates auth to the host process. The MCP server
  itself is not multi-tenant.
- If we later expose HTTP / SSE transport, OAuth or mTLS is required.

## Dependencies

- `pip-audit -r requirements/base.txt --strict` runs in CI on every PR.
- Trivy scans the runtime image for OS + lang CVEs and uploads SARIF to
  the GitHub Security tab.
- Gitleaks runs on every commit for accidental secret commits.

## Container hardening

- Multi-stage build; final image only carries the venv + app code.
- Non-root user (`synthora`, UID/GID 10001), `no-new-privileges`,
  dropped capabilities, read-only root filesystem, writable `/tmp`
  mounted as size-limited tmpfs.
- Multi-arch (`amd64` + `arm64`) builds via Docker Buildx.

## Reporting a vulnerability

Open a private security advisory on the repository or email the
maintainers. Do not file a public issue.
