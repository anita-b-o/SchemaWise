# Free staging provisioning plan

Status: **ready for provisioning**. ADR 016's proxy/IP security implementation and local tests pass. Cloud behavior remains a post-deploy gate. This replaces the former paid/custom-domain staging plan. No resource, DNS, secret, deploy or push has been created.

## Topology

```text
Browser -> https://<vercel-project>.vercel.app
             /       Vite SPA
             /api/*  same-origin Vercel Function proxy
                       -> https://<render-service>.onrender.com/api/*
                            -> Neon Free PostgreSQL
```

Browser calls must be `https://<vercel-project>.vercel.app/api/v1/...`, never `onrender.com`. A Vercel external rewrite can map `/api/:path*` to `https://<render-service>.onrender.com/api/:path*` without changing the visible URL, but is rejected as the final authenticated proxy: it has no reviewed documented mechanism for a server-only assertion that safely conveys Vercel's client-IP metadata to Render.

ADR 016 accepts the implemented Vercel Function proxy. It reads Vercel's sanitized `x-vercel-forwarded-for`, passes method/body/cookie/Origin/Referer to a fixed Render origin, relays response status/body/all `Set-Cookie` headers, and adds an HMAC-SHA-256, request-bound, 60-second client-IP assertion. Render validates the assertion before protected-route or rate-limit work. This keeps the existing security policy; no `SameSite=None`, JWT, JS-readable cookie, wildcard CORS, disabled CSRF, or disabled limits.

## Providers

### Neon Free

- Separate `schemawise_staging` project/database, no production data; prefer N. Virginia with Render Virginia.
- Runtime uses generated pooled URL and `DATABASE_POOL_MAX=5`; controlled migrations use direct URL. Retain `sslmode=verify-full` and `channel_binding=require`.
- Current Free allowance: 100 CU-hours/month/project, 0.5 GB storage/project, 5 GB public egress/month, ten branches, maximum 2 CU, and up to six-hour restore history. Scale-to-zero is fixed after five inactive minutes. This is disposable staging, not recovery validation.

### Render Free Web Service

- One native Node 22 Web Service, repository root, Virginia; build `npm ci && npm run build --workspace @schemawise/api`; start `npm start --workspace @schemawise/api`; `HOST=0.0.0.0`; provider `PORT`; `/ready` health check.
- Do not define pre-deploy: Render documents it as paid-service-only. Never migrate from startup.
- It sleeps after 15 idle minutes and the next request takes about one minute to wake it. Filesystem is ephemeral. 750 workspace free instance-hours reset monthly; exhausted bandwidth/build-pipeline allowance can suspend service. Do not add a keepalive.

### Vercel Hobby

- Separate Vite project with Root Directory `apps/web`; keep monorepo source inclusion enabled, install from the detected root lockfile, build `npm run build`, output `dist`. The Function is `api/[...path].ts` relative to that project root.
- Published relevant limits include 200 projects, 100 deployments/day, 45 build minutes/deployment, one concurrent build, and 120 seconds for external proxied requests. A Function proxy has plan-specific function-duration limits; recheck the active Hobby limit before deploy.
- 120 s exceeds Render's stated roughly one-minute wake-up, but real cold-start compatibility remains a gate, not a promise.

## Controlled manual migration

Before first API deploy, source the direct Neon URL from a local secret manager or mode-600 untracked file (not shell history), then execute:

```bash
DATABASE_MIGRATION_URL='<direct Neon URL>' \
  npm run db:migrate --workspace @schemawise/api -- --database-url-var DATABASE_MIGRATION_URL
```

Do not keep `DATABASE_MIGRATION_URL` in Render runtime configuration. Verify read-only via Neon SQL editor or direct secure client: migrations 001–004 in `pgmigrations`, then zero `users` and `projects`. The SQL editor is not the migration runner.

## Provisioning order

1. Neon Free; isolated DB; manual migration and verification.
2. Render Free; staging-only runtime variables; deploy; direct `/health` and `/ready` check.
3. Vercel Hobby; `VITE_SCHEMAWISE_API_URL=/`; deploy Web and Function.
4. Complete API/proxy/browser/security smoke gates before declaring the environment operational.

## Sources checked 2026-09-09

- [Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite), [Functions API](https://vercel.com/docs/functions/functions-api-reference), [monorepos](https://vercel.com/docs/monorepos), [limits](https://vercel.com/docs/limits), [request headers](https://vercel.com/docs/headers/request-headers)
- [Render Free](https://render.com/docs/free), [deploy lifecycle](https://render.com/docs/deploys)
- [Neon pricing](https://neon.com/pricing), [scale to zero](https://neon.com/docs/introduction/scale-to-zero)
