# SchemaWise v1 staging audit

Date: 2026-09-11  
Verdict: **SCHEMAWISE V1 STAGING: READY WITH LIMITATIONS**

## Scope and topology

This audit formally closes the deployed v1 staging environment. It introduced no
product feature, production change, cloud configuration change, secret change,
or automatic data deletion.

```text
Browser -> Vercel Hobby (Vite Web + Function proxy)
        -> Render Free (Fastify API, Virginia, one instance)
        -> Neon Free (PostgreSQL 17, N. Virginia)
```

- Web: <https://schemawise-staging.vercel.app>
- API: <https://schemawise-api-staging.onrender.com>
- Browser API traffic: `https://schemawise-staging.vercel.app/api/v1/*`

Vercel uses Root Directory `apps/web`, Node 22, `npm ci --include=dev`,
`npm run build`, Vite, `api/proxy.ts`, and the explicit rewrite
`/api/v1/(.*) -> /api/proxy`. Render uses the Free plan in Virginia with one
instance and `CLIENT_IP_MODE=vercel-proxy`. Neon uses a pooled runtime connection,
a direct migration connection, and `DATABASE_POOL_MAX=5`.

## Revisions

- Repository verification baseline after the test-only commit:
  `be453aef244e6edde6a3b13fc325cd551705898b`.
- Vercel deployed SHA behind the public alias:
  `635d41774b6acb939d6b09cb317b6ea1153645fc`.
- Render live deployed SHA:
  `635d41774b6acb939d6b09cb317b6ea1153645fc`.
- The final documentation commit is intentionally separate and is recorded in
  Git history; a commit cannot include its own SHA in its contents.

The push of the test-only commit caused Vercel Git integration to create a
deployment attempt, but Vercel classified it as `CANCELED`. The public alias
remained on the prior `READY` deployment. Render has auto-deploy disabled and
created no deployment. No test-only or documentation commit is required in the
runtime artifacts.

## Staging checks

### Verified in real staging

- `GET /health` returned `200 {"status":"ok"}`.
- `GET /ready` returned `200 {"status":"ready"}`, confirming database access.
- One non-persistent analysis through Vercel returned 200 for `R(A,B,C)`,
  `A -> B`, `B -> C`: candidate keys `[["a"]]`, 2NF satisfied, 3NF violated,
  and BCNF violated.
- The same anonymous computational route remained intentionally available
  directly on Render and returned 200.
- Direct unauthenticated Render calls to `/api/v1/auth/me` and
  `/api/v1/projects` each returned 403 `INVALID_PROXY_ASSERTION`.
- A real API response through Vercel returned
  `Access-Control-Allow-Origin: https://schemawise-staging.vercel.app` and
  `Access-Control-Allow-Credentials: true`; it did not use wildcard CORS.
- Direct `/api/proxy` returned the safe 404 `PROXY_ROUTE_NOT_FOUND`, so the
  Function entrypoint is not an alternate upstream path.
- The deployed browser smoke passed Web load, Load example, analysis,
  Transformations/Closure, register/login/logout/refresh, project create/open/
  update/delete, Saved/Unsaved behavior, draft recovery, and two-session OCC.
  The stale writer received 409 `PROJECT_REVISION_CONFLICT`; no silent overwrite
  occurred. Browser Auth/Projects traffic used Vercel, never Render directly.
- The observed session cookie was host-only, `HttpOnly`, `Secure`,
  `SameSite=Lax`, and `Path=/`.

### Verified by code and automated tests

- `apps/web/api` contains only `proxy.ts`; `apps/web/vercel.json` routes every
  `/api/v1/*` request internally to it. The handler preserves method, body,
  original path/query, Origin/Referer, cookies, response status, and independent
  Set-Cookie headers.
- HMAC assertions bind method, visible path/query, timestamp, and the client IP
  sourced from Vercel's `x-vercel-forwarded-for`. Incoming forwarded-IP and
  SchemaWise assertion headers are removed before new assertion headers are set.
- `STAGING_PROXY_SECRET` is server-only. A scan of the built browser bundle found
  neither that identifier nor test secret markers.
- The raw session token is generated randomly and is not stored in PostgreSQL.
  Sessions store a unique SHA-256 `token_hash`; lookup and logout hash the
  presented cookie before database access.
- CSRF is an HMAC-SHA-256 value bound to `sessionId`, compared in constant time,
  and kept only in React memory. The Web source contains no localStorage or
  sessionStorage persistence for it.
- Passwords use Argon2id (`m=65536`, `t=3`, `p=1`) and unknown-user login runs a
  dummy Argon2 verification.
- Auth rate limits are active: login IP 20/15 minutes, login email+IP 5/15
  minutes, and registration IP 5/hour. Buckets use the verified proxy identity;
  limits are process-local.
- Every project repository operation includes `owner_id`; foreign and missing
  project identifiers share not-found behavior. Updates atomically require the
  expected revision and increment it, producing the 409 OCC conflict on stale
  writes.

## Database

A read-only Neon query confirmed PostgreSQL 17 and migrations
`001_create_projects`, `002_create_users`, `003_create_sessions`, and
`004_add_project_owner`. It also confirmed the ownership foreign key with
`ON DELETE RESTRICT`, positive revision and nonblank-name checks, session
ownership with `ON DELETE CASCADE`, and uniqueness of session token hashes.

Smoke data remains in place: 1 user, 1 project, and 1 active session. No email or
other PII was queried or displayed, and no row was changed or deleted.

## Logs

A small 24-hour Vercel runtime sample and a 30-entry Render sample were inspected.
They contained method/path/status/timing and provider request metadata only. No
password, cookie value, session token, CSRF token, proxy secret, database URL,
credential-bearing SQL, or sensitive request body was present. Fastify's logger
also explicitly redacts authorization, cookie, CSRF, proxy IP, and proxy
signature headers.

## Automated validation

- `npm run typecheck`: passed for API, Web, and normalization engine.
- `npm test`: 35 files and 404 tests passed (API 140, Web 90, engine 174).
- `npm run build`: passed; API/engine compiled and Vite built 54 modules.
- `npm run build --workspace @schemawise/web`: passed; 54 modules built.
- `npm run test --workspace @schemawise/api`: 10 files and 140 tests passed.
- Targeted pending-test validation: 1 file and 8 tests passed.
- `git diff --check`: passed.
- `npm audit --omit=dev`: 0 vulnerabilities.

`DATABASE_URL` was not present in the local test environment, so the destructive
PostgreSQL integration suite was not run or pointed at staging. Database state
was verified only through `/ready` and a read-only Neon query.

## Resolved deployment incidents

- Render clean builds initially could not find the engine package.
- `NODE_ENV=production` initially omitted compile-time devDependencies.
- The Vercel Web build depended implicitly on hoisted TypeScript.
- `api/[...path].ts` did not behave as the required multi-segment catch-all in
  this Vite/Vercel deployment; it was replaced with `api/proxy.ts` plus an
  explicit rewrite.
- `RENDER_API_ORIGIN` and `CORS_ORIGINS` were corrected.
- Render was advanced from an older revision to the audited revision.
- Register succeeded after deployment and configuration were corrected.

## Security headers

Vercel currently supplies HSTS. The checked Web response did not include an
application CSP, explicit frame protection, `Referrer-Policy`, or
`X-Content-Type-Options`. These are recommended before production but are not a
blocker for the staging portfolio. They were not implemented in this audit.

## Accepted staging limitations

- Render Free can sleep/cold-start; Neon Free can scale to zero.
- The rate limiter is in memory and the API is intentionally limited to one
  instance.
- Staging has no SLA and is not a performance benchmark.
- Refresh restores authentication but loses the in-memory workspace and open
  project association; saved projects can be reopened.
- The frontend exposes only the 20 most recently updated projects.
- There is no autosave, router, or project deep link.
- Backup, retention, and recovery are limited by Free-plan capabilities.

## Deferred before production

Production planning must revisit CSP, frame protection, Referrer-Policy,
X-Content-Type-Options, shared/distributed rate limiting before horizontal
scaling, production-grade backups/recovery, monitoring/alerting and SLA,
capacity/performance validation, and workspace/deep-link recovery. Staging must
not be promoted as production-equivalent.

## Final result

No reproducible functional, security, ownership, persistence, or OCC defect was
found. Only deliberate Free-tier constraints and production hardening remain.

**SCHEMAWISE V1 STAGING: READY WITH LIMITATIONS**
