# Free staging smoke and gates

Use a fresh browser profile:

```text
WEB_ORIGIN=https://<vercel-project>.vercel.app
API_PATH=/api/v1
RENDER_ORIGIN=https://<render-service>.onrender.com
```

Record commit SHA, timestamp, browser, tester, and non-secret evidence.

## Browser/API

- [ ] Network requests for analysis/auth/projects use `$WEB_ORIGIN/api/v1/...`, never `onrender.com`.
- [ ] Analyze, 3NF, BCNF, Closure and dependency preservation work anonymously.
- [ ] Register, Me, Logout, Login and Me work.
- [ ] `schemawise_session` is host-only for Vercel host, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`, and absent from web storage/JS.
- [ ] Save/Open/OCC conflict/Delete project work.
- [ ] Fastify sees approved browser Origin/Referer; disallowed Origin and missing/invalid CSRF fail. Exact CORS allowlist remains; no wildcard.

## Provider/proxy

- [ ] Direct Render `/health` and `/ready` return 200 once awake.
- [ ] After 15 idle minutes, record full Vercel-to-Render cold-start duration; no browser/proxy/function timeout.
- [ ] Login/register relay preserves every `Set-Cookie` attribute and browser stores it on Vercel host.
- [ ] Diagnostics demonstrate sanitized Vercel IP reaches Function, forged browser client-IP metadata is ignored, and Render accepts only HMAC-authenticated assertion.
- [ ] Exercise 20/15m login IP, 5/15m email+IP and 5/h register IP buckets with distinct clients where practical; direct callers cannot poison a shared Vercel identity.
- [ ] Direct `onrender.com` rejects protected/auth functional requests lacking assertion; anonymous computation remains intentionally public and requires no CSRF/session.
- [ ] Vercel deployment exposes the catch-all Function for every `/api/v1/*` path and includes `@schemawise/proxy-assertion` from the monorepo workspace.

## Post-deploy-only gates

Browser storage of a proxied host-only Set-Cookie, the actual Vercel-sanitized header chain, platform catch-all routing/workspace bundling, cold start versus Function timeout, and health-check impact on Render/Neon sleep cannot be proven before deployment. Origin/Referer/header relay, independent Set-Cookie relay, HMAC identity verification and the complete functional chain are covered locally. Failure of a cloud-only gate leaves Free staging non-operational; do not weaken security to pass.
