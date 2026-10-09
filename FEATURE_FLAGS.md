# Feature Flags & Progressive Rollout

An in-house, MongoDB-backed feature-flag framework for reducing release risk on high-impact changes: toggle features without redeploying, roll out progressively by percentage or audience, and kill-switch risky AI/ingestion features server-side.

This is not a third-party vendor integration (no LaunchDarkly/Unleash/GrowthBook) — it's built from the existing stack (Express, Mongoose, MongoDB) to avoid adding a new dependency, account, or billing surface for this scope.

## Data model

`backend/src/models/featureFlag.model.ts`:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `key` | string (unique, lowercase, `[a-z0-9_-]+`) | — | Identifier used in code and the API |
| `description` | string | — | Human-readable explanation |
| `enabled` | boolean | `true` | Master switch. `false` = off for everyone, instantly. **This is the kill switch.** |
| `rolloutPercentage` | number (0–100) | `100` | Percentage of identities deterministically bucketed in |
| `audience.internalUsers` | boolean | `false` | Internal-email-domain users bypass the percentage rollout |
| `audience.premiumOnly` | boolean | `false` | Restricts eligibility to premium users (see caveat below) |
| `overrides.allow` | string[] | `[]` | User ids/emails explicitly forced on |
| `overrides.deny` | string[] | `[]` | User ids/emails explicitly forced off (wins over allow) |
| `createdBy` / `updatedBy` | string | — | Admin email, for an audit trail |

## Evaluation order

Implemented in `backend/src/services/featureFlag.service.ts`'s `isEnabled(key, ctx)`, in this exact order:

1. `enabled === false` → always `false`. The kill switch.
2. Deny list match → `false` (wins over everything below).
3. Allow list match → `true`.
4. `premiumOnly === true` and the caller isn't premium → `false` (a *restriction* — narrows eligibility).
5. `internalUsers === true` and the caller is internal → `true` (a *bypass* — skips the percentage check).
6. Otherwise, deterministic percentage rollout: `bucket = sha256("<flagKey>:<identity>") % 100 < rolloutPercentage`.

A flag `key` with no document in the database evaluates to `false`. There is no implicit "on by default" for an unseeded flag — if you add a `requireFeatureFlag("some-key")` check to a route, that route goes dark until the flag document exists (see **Adding a new flag-gated route** below).

### No identity (server-to-server / future ingestion callers)

Only the frontend calls the currently-gated routes (`/api/bias/analyze`, `/api/bias/analyze-batch`) today, but the ticket this framework was built for explicitly names ingestion kill-switches as a future use case, so the "no identity" semantics are specified precisely:

- `premiumOnly` **fails closed** (`false`) — a restriction can't wave through a caller it can't verify.
- The `internalUsers` **bypass does not apply** — it falls through to the percentage check instead of auto-passing.
- Percentage rollout only passes when `rolloutPercentage === 100` — an identity-less caller can't be fractionally bucketed, so it only sees the feature once fully launched.

The master kill switch (`enabled:false`) and deny list still apply unconditionally, which is what actually matters for an ingestion kill switch.

## Identity & bucketing

- Authenticated callers: `userId` from the JWT.
- Unauthenticated frontend callers: a `crypto.randomUUID()` generated once and persisted in `localStorage` (`ff_anon_id`), sent as the `x-anonymous-id` header.
- The hash input includes the flag key, so one user's bucket differs per flag — flipping one flag's rollout doesn't correlate with another's for the same user.

**Feature flags are not an access-control mechanism.** The anonymous id is client-controlled — a logged-out user can reset or fabricate it. This is fine for its purpose (statistically distributing a rollout) but must never be the basis for restricting access to anything sensitive; that requires real authentication/authorization. Allow/deny lists and the `premiumOnly`/`internalUsers` cohorts control *exposure* of functionality that's already safe for the requesting identity — not entitlements.

## Server-side enforcement — the actual kill switch

Hiding a button in the UI is not a kill switch; it doesn't stop someone from calling the route directly. The real enforcement is `requireFeatureFlag(key)` (`backend/src/middleware/featureFlag.middleware.ts`), mounted on the route itself:

```ts
router.post("/analyze", optionalAuthenticate, requireFeatureFlag("ai-bias-analysis"), handler);
```

It builds identity from an optional JWT (via `optionalAuthenticate`, which never 401s) plus `x-anonymous-id`/`?anonId=`, and responds `403 { error: "Feature disabled" }` when the flag is off, or `503` if the flag check itself fails (DB error) — never an uncaught hang.

**Any frontend call to a gated route must send the identity headers.** Under the no-identity semantics above, a request missing both `Authorization` and `x-anonymous-id` is only let through once a flag reaches 100% rollout — it'll work today and break silently the moment a partial rollout starts. Use `gatedRequestHeaders()` from `frontend/services/featureFlags.ts` (not an inline header literal) on every such call.

## Caching and the "no redeploy" guarantee

Flags are read through a 10-second in-memory cache per backend instance; every admin write calls `invalidateCache()` immediately. Because flags are DB rows read at request time — never baked into a build — toggling one never requires a redeploy.

**Honest multi-instance caveat**: `invalidateCache()` only clears the cache on the instance that handled the admin write. In a multi-instance deployment, other instances keep serving their own cached value until their own 10s TTL expires — so fleet-wide propagation is "one cache TTL per instance," not instant. A future iteration could push invalidation through Redis pub/sub for true instant fleet-wide propagation; out of scope here.

## Adding a new flag-gated route

1. Create the flag (via the admin API, or add it to `seedFeatureFlags.ts` for a documented example).
2. Add `optionalAuthenticate, requireFeatureFlag("your-key")` to the route.
3. **Decide whether the route needs to be self-seeding.** If a missing flag document would silently break an already-shipped feature in some environment (local/staging/prod), add the key to `BASELINE_FLAG_KEYS` in `featureFlag.service.ts` so `ensureBaselineFlags()` creates it (enabled) at startup — don't rely on everyone remembering to run the seed script.
4. If the frontend calls this route, use `gatedRequestHeaders()` from `frontend/services/featureFlags.ts` on that call.
5. Baseline flags (anything in `BASELINE_FLAG_KEYS`) cannot be deleted via the admin API — only disabled with `enabled:false` — otherwise `ensureBaselineFlags()` would silently recreate it as enabled on the next restart.

## Admin API

All routes except `/evaluate` require `authenticate` + `requireAdmin` (checks `req.user.email` against the comma-separated `FEATURE_FLAG_ADMIN_EMAILS` env var).

```bash
# Evaluate flags for the current caller (works logged out too)
curl -H "x-anonymous-id: <uuid>" https://<host>/api/flags/evaluate

# List all flags (admin)
curl -H "Authorization: <jwt>" https://<host>/api/flags

# Create a flag (admin)
curl -X POST -H "Authorization: <jwt>" -H "Content-Type: application/json" \
  -d '{"key":"my-new-feature","enabled":true,"rolloutPercentage":10}' \
  https://<host>/api/flags

# Update a flag — e.g. flip the kill switch (admin)
curl -X PUT -H "Authorization: <jwt>" -H "Content-Type: application/json" \
  -d '{"enabled":false}' \
  https://<host>/api/flags/my-new-feature

# Delete a (non-baseline) flag (admin)
curl -X DELETE -H "Authorization: <jwt>" https://<host>/api/flags/my-new-feature
```

## Cohort configuration

- **Internal**: `FEATURE_FLAG_INTERNAL_EMAIL_DOMAINS` — comma-separated email domains (e.g. `synthoraai.io`).
- **Premium**: no subscription/premium concept exists anywhere in this codebase today (checked `user.model.ts`, `rating.model.ts`, `comment.model.ts`). `isPremiumUser()` is an explicit stub returning `false` — `premiumOnly` flags are unreachable until a real premium concept is introduced. This is intentional, not a bug.
- **Admin** (flag management, not a cohort): `FEATURE_FLAG_ADMIN_EMAILS` — comma-separated.

## Kill-switch procedure

1. `PUT /api/flags/<key>` with `{"enabled": false}`.
2. Confirm via `GET /api/flags/evaluate` (and, for a server-enforced route, a direct request to the route itself — it should now `403`).
3. Expect propagation within one cache TTL (~10s) per backend instance.
4. Frontend tabs already open will reflect it within ~30s via the provider's polling refresh — but don't rely on that for the actual kill; the server-side `403` is the real guarantee regardless of client state.

## Staged rollout playbook

1. **0%** — flag created, `enabled:true`, `rolloutPercentage:0`. Nothing user-facing changes; useful for verifying the flag plumbing itself.
2. **Internal only** — `audience.internalUsers:true`, percentage still low/zero. Dogfood with the team.
3. **10%** — small, real-user exposure. Watch error rates/cost/latency for the gated feature specifically.
4. **50%** — broader exposure once 10% looks healthy.
5. **100%** — full launch. Consider removing the flag check once it's been stable for a while (reduces code to reason about).

## Rollback runbook

> **This procedure must be exercised in staging before being relied on in production.** It is documented here as the intended path, not as something already validated live.

1. Identify the flag key gating the problematic feature (check `FEATURE_FLAGS.md`'s route list or `grep -r "requireFeatureFlag\|isEnabled" backend/src`).
2. `PUT /api/flags/<key>` with `{"enabled": false}` (full kill) or `{"rolloutPercentage": <lower value>}` (partial rollback).
3. Verify via `GET /api/flags/evaluate` and a direct call to the affected route.
4. Notify the team (who owns the feature, who's on call).
5. Write a short postmortem: what triggered the rollback, what the flag state was, what changed before re-enabling.

## Known limitations / future work

- No admin UI — management is via the REST API and `seedFeatureFlags.ts`. A UI is a reasonable follow-up.
- Cache invalidation is per-instance, not fleet-wide-instant (see above). Redis pub/sub would close this gap.
- `orchestration/` (the TypeScript chat-agent package) is not wired into this framework — it's currently unwired into the backend at all, so gating it is out of scope here.
- `premiumOnly` is unreachable until a real premium/subscription concept exists.
- No automated test covers the frontend provider's fail-closed/stale-while-revalidate/polling behavior — only backend logic is covered by Jest; the frontend behavior is verified by manual browser testing.
