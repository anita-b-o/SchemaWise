# Free staging provisioning plan

Status: **Staging provisioned, deployed, and audited** on 2026-09-11. The isolated Neon Free database, Render API, and Vercel Web/Function proxy are operational. No production resource was created or modified. See the [staging audit](../testing/schemawise-v1-staging-audit.md).

## Topology

```text
Browser -> https://schemawise-staging.vercel.app
             /       Vite SPA
             /api/*  same-origin Vercel Function proxy
                       -> https://schemawise-api-staging.onrender.com/api/*
                            -> Neon Free PostgreSQL
```

Browser calls must be `https://<vercel-project>.vercel.app/api/v1/...`, never `onrender.com`. A Vercel external rewrite can map `/api/:path*` to `https://<render-service>.onrender.com/api/:path*` without changing the visible URL, but is rejected as the final authenticated proxy: it has no reviewed documented mechanism for a server-only assertion that safely conveys Vercel's client-IP metadata to Render.

ADR 016 accepts the implemented Vercel Function proxy. It reads Vercel's sanitized `x-vercel-forwarded-for`, passes method/body/cookie/Origin/Referer to a fixed Render origin, relays response status/body/all `Set-Cookie` headers, and adds an HMAC-SHA-256, request-bound, 60-second client-IP assertion. Render validates the assertion before protected-route or rate-limit work. This keeps the existing security policy; no `SameSite=None`, JWT, JS-readable cookie, wildcard CORS, disabled CSRF, or disabled limits.

## Providers

### Neon Free

- Project `schemawise-staging`, branch `main`, database `schemawise_staging`; AWS N. Virginia (`aws-us-east-1`), PostgreSQL 17. This is isolated from production.
- Runtime uses the pooled host pattern `ep-***-pooler.c-11.us-east-1.aws.neon.tech`; controlled migrations use the direct `ep-***.c-11.us-east-1.aws.neon.tech` endpoint. Both use `sslmode=verify-full` and `channel_binding=require`; credentials remain outside Git.
- Keep `DATABASE_POOL_MAX=5`. The pooled endpoint is for the single future Render API; the direct endpoint is only for migrations and administrative operations.
- Verified read-only on 2026-09-11: migrations 001–004 remain applied, ownership/revision/session constraints remain present, `/ready` reaches PostgreSQL, and retained smoke data totals one user, one project, and one active session. No PII was queried or displayed.
- Current Free allowance: 100 CU-hours/month/project, 0.5 GB storage/project, 5 GB public egress/month, ten branches, maximum 2 CU, and restore history up to six hours or 1 GB of changes, whichever is reached first. Scale-to-zero is fixed after five inactive minutes; the first connection after suspension has wake-up latency. This is disposable staging, not a production backup or latency benchmark.

### Render Free Web Service

- One native Node 22 Web Service, repository root, Virginia; build `npm ci --include=dev && npm run build --workspace @schemawise/api`; start `npm start --workspace @schemawise/api`; `HOST=0.0.0.0`; provider `PORT`; `/ready` health check. `NODE_ENV=production` remains the runtime environment; `--include=dev` explicitly installs the TypeScript compiler and build-time type packages needed during the build, without moving them into runtime dependencies.
- Do not define pre-deploy: Render documents it as paid-service-only. Never migrate from startup.
- It sleeps after 15 idle minutes and the next request takes about one minute to wake it. Filesystem is ephemeral. 750 workspace free instance-hours reset monthly; exhausted bandwidth/build-pipeline allowance can suspend service. Do not add a keepalive.

### Vercel Hobby

- Separate Vite project with Root Directory `apps/web`; keep monorepo source inclusion enabled, install from the detected root lockfile, build `npm run build`, output `dist`. The single Function is `api/proxy.ts` relative to that project root, and `apps/web/vercel.json` explicitly rewrites `/api/v1/(.*)` to it.
- Published relevant limits include 200 projects, 100 deployments/day, 45 build minutes/deployment, one concurrent build, and 120 seconds for external proxied requests. A Function proxy has plan-specific function-duration limits; recheck the active Hobby limit before deploy.
- 120 s exceeds Render's stated roughly one-minute wake-up, but real cold-start compatibility remains a gate, not a promise.

Project deep links v1.2 are accepted but not deployed. Its implementation must
append the SPA fallback after the security-critical API rewrite:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/api/v1/(.*)", "destination": "/api/proxy" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Do not reverse these entries or bypass `/api/proxy`. The deployment gate must
verify a direct refresh at `/projects/<uuid>` returns the SPA and that auth and
project `/api/v1/*` requests still reach the Function proxy. This paragraph is
design documentation only; `apps/web/vercel.json` remains unchanged in this
tranche.

## Controlled manual migration

The initial staging migration was completed on 2026-09-09. For future controlled migrations, source the direct Neon URL from a local secret manager or mode-600 untracked file (not shell history), then execute:

```bash
DATABASE_MIGRATION_URL='<direct Neon URL>' \
  npm run db:migrate --workspace @schemawise/api -- --database-url-var DATABASE_MIGRATION_URL
```

Do not keep `DATABASE_MIGRATION_URL` in Render runtime configuration. Verify read-only via Neon SQL editor or direct secure client. The SQL editor is not the migration runner.

## Provisioning order

1. [x] Neon Free; isolated DB; manual migration and verification.
2. [x] Render Free; staging-only runtime variables; deploy; direct `/health` and `/ready` check.
3. [x] Vercel Hobby; `VITE_SCHEMAWISE_API_URL=/`; deploy Web and Function.
4. [x] Complete API/proxy/browser/security smoke gates and formal staging audit.

## Sources checked 2026-09-09

- [Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite), [Functions API](https://vercel.com/docs/functions/functions-api-reference), [monorepos](https://vercel.com/docs/monorepos), [limits](https://vercel.com/docs/limits), [request headers](https://vercel.com/docs/headers/request-headers)
- [Render Free](https://render.com/docs/free), [deploy lifecycle](https://render.com/docs/deploys)
- [Neon pricing](https://neon.com/pricing), [scale to zero](https://neon.com/docs/introduction/scale-to-zero)
