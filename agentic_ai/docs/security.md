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
- Base image pinned by digest (`python:3.11-slim-bookworm@sha256:...`)
  for reproducible, supply-chain-verifiable builds.
- Build tooling (`pip`, `setuptools`, `wheel`) is stripped from the
  runtime image — the runtime never installs packages, and removing it
  eliminates that tooling's CVEs (and its vendored deps).
- Vector-store deps (`chromadb`, `faiss`, `pinecone`) are an opt-in
  extra, not in the base image — smaller surface, ~250MB lighter.
- Non-root user (`synthora`, UID/GID 10001), `no-new-privileges`,
  dropped capabilities, read-only root filesystem, writable `/tmp`
  mounted as size-limited tmpfs.
- Multi-arch (`amd64` + `arm64`) builds via Docker Buildx.

## CVE posture

Trivy scans the image in CI (`agentic-ai-ci.yml`); `pip-audit` audits
the dependency manifest. Current posture:

**Python dependencies — zero known vulnerabilities.** Both Trivy and
`pip-audit` report no CVEs. The stack is on the **langchain 1.x line**;
the migration off 0.3.x cleared the full set of langchain/langgraph/
langsmith CVEs (an RCE, deserialization, XXE, path-traversal, and
prompt-injection class). Only the packages the code imports are
installed — the unused `langchain` meta-package, `langchain-community`,
`langchain-text-splitters`, and the raw provider SDKs were removed, both
shrinking the surface and dropping `langchain-community`'s CVEs.
`langchain-cohere` has no langchain-1.x release and is therefore not
installed; the Cohere provider returns automatically once upstream
ships a 1.x package.

Dependency lower bounds in `pyproject.toml` / `requirements/base.txt`
are pinned to CVE-patched releases and must be raised whenever a new CVE
is disclosed. `.trivyignore` currently has no Python entries.

**OS packages** — the Debian base carries CVEs with no upstream fix
available yet (`FixedVersion` empty). These are common to every
Debian-slim Python image; mitigated by the container hardening above
(non-root, read-only fs, dropped caps, minimal installed package set —
build tooling is stripped). Refresh the pinned base-image digest
regularly to pick up Debian patches as they ship. A distroless /
Chainguard base would clear most of these and is a tracked follow-up.

## Reporting a vulnerability

Open a private security advisory on the repository or email the
maintainers. Do not file a public issue.
