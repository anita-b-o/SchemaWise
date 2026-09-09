# Auth HTTP security verification

## Coverage

Unit/inject tests verify deterministic HMAC generation from an internal session
ID, stability within a session, rotation on a new session, and rejection of a
different session's token. Valid-session logout rejects missing, malformed, or
wrong `X-CSRF-Token` with 403 and succeeds with the matching token. Missing,
invalid, expired, and revoked cookies retain idempotent 204 cleanup.

Origin tests cover exact allowed values, disallowed and lookalike origins,
strict parsed Referer fallback, malformed Referer, Origin precedence, and the
documented direct-client behavior when both headers are absent. CORS preflight
asserts exact ACAO, credentials true, no wildcard, and permission for
`X-CSRF-Token`.

Rate-limit tests inject reduced deterministic thresholds and independently prove
login IP, canonical-email+IP, and register IP buckets. They assert generic
`AUTH_RATE_LIMITED`, `Retry-After`, no bucket/email details, and no global limit
on computational routes. Production defaults remain 20/15 minutes, 5/15
minutes, and 5/hour respectively.

## PostgreSQL and TCP

`tests/integration/auth-http-postgres.test.ts` creates an isolated migrated
schema, starts Fastify on an ephemeral loopback TCP port, and uses real `fetch`
requests. It registers, reads me, logs in to a second session, proves the CSRF
tokens differ, rejects missing/wrong/cross-session logout tokens, accepts the
matching token, verifies the first session is revoked, and proves the second
session remains active.

Run with an isolated PostgreSQL database:

```bash
DATABASE_URL=postgresql://... npm run test:integration --workspace @schemawise/api
```

The in-memory limiter is intentionally single-process. Multi-instance deployment
requires a shared store. `TRUST_PROXY=false` is the safe local default; set true
only when every direct connection is from the deployment's trusted proxy.
