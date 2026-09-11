# Free staging smoke and gates

Status: **Passed 2026-09-11** for SchemaWise v1 staging. Real browser and HTTP
evidence is recorded in the [staging audit](../testing/schemawise-v1-staging-audit.md).
High-volume rate-limit probing was intentionally not repeated against staging;
that policy is covered by unit/integration tests. Free-tier cold-start latency is
an accepted staging limitation, not a performance guarantee.

Use a fresh browser profile:

```text
WEB_ORIGIN=https://<vercel-project>.vercel.app
API_PATH=/api/v1
RENDER_ORIGIN=https://<render-service>.onrender.com
```

Record commit SHA, timestamp, browser, tester, and non-secret evidence.

## Browser/API

- [x] Network requests for analysis/auth/projects use `$WEB_ORIGIN/api/v1/...`, never `onrender.com`.
- [x] Analyze, 3NF, BCNF, Closure and dependency preservation work anonymously.
- [x] Register, Me, Logout, Login and Me work.
- [x] `schemawise_session` is host-only for Vercel host, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`, and absent from web storage/JS.
- [x] Save/Open/OCC conflict/Delete project work.
- [x] Fastify sees approved browser Origin/Referer; disallowed Origin and missing/invalid CSRF fail. Exact CORS allowlist remains; no wildcard.

## Provider/proxy

- [x] Direct Render `/health` and `/ready` return 200 once awake.
- [x] Free-tier cold start is documented and accepted; staging is not a latency benchmark.
- [x] Login/register relay preserves every `Set-Cookie` attribute and browser stores it on Vercel host.
- [x] Diagnostics and tests demonstrate sanitized Vercel IP reaches Function, forged browser client-IP metadata is ignored, and Render accepts only HMAC-authenticated assertion.
- [x] The 20/15m login IP, 5/15m email+IP and 5/h register IP buckets are covered without high-volume staging traffic; direct callers cannot poison a shared Vercel identity.
- [x] Direct `onrender.com` rejects protected/auth functional requests lacking assertion; anonymous computation remains intentionally public and requires no CSRF/session.
- [x] Vercel deployment exposes the Function for every rewritten `/api/v1/*` path and includes `@schemawise/proxy-assertion` from the monorepo workspace.

## Post-deploy-only gates

Browser storage of a proxied host-only Set-Cookie, the actual Vercel-sanitized header chain, platform catch-all routing/workspace bundling, cold start versus Function timeout, and health-check impact on Render/Neon sleep cannot be proven before deployment. Origin/Referer/header relay, independent Set-Cookie relay, HMAC identity verification and the complete functional chain are covered locally. Failure of a cloud-only gate leaves Free staging non-operational; do not weaken security to pass.
