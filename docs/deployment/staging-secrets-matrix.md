# Staging secrets and environment matrix

No real value belongs in this file, Git, build output, deployment notes, or
smoke-test screenshots. `<domain>` is a controllable SchemaWise base domain or
delegated subdomain.

## Render API: `schemawise-api-staging`

| Variable | Secret? | Staging value/pattern | Source | Required? |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Neon **pooled** URL; `-pooler` hostname; `sslmode=verify-full&channel_binding=require` | Neon Connect dialog, pooled mode | Yes, API runtime |
| `DATABASE_MIGRATION_URL` | Yes | Same branch/database/role, Neon **direct** URL; no `-pooler`; `sslmode=verify-full&channel_binding=require` | Neon Connect dialog, direct mode | Yes, migration only |
| `DATABASE_POOL_MAX` | No | `5` | SchemaWise staging policy | Yes (explicit) |
| `AUTH_COOKIE_SECURE` | No | `true` | SchemaWise HTTPS policy | Yes |
| `CSRF_SECRET` | Yes | Independent random value with at least 32 bytes of entropy; recommended `openssl rand -base64 48` | Generated locally, entered directly in Render | Yes |
| `CORS_ORIGINS` | No | `https://staging.<domain>`; exact origin, no trailing slash | Approved staging hostname | Yes |
| `CLIENT_IP_MODE` | No | `render` | Render's overwritten `CF-Connecting-IP` contract | Yes (explicit) |
| `HOST` | No | `0.0.0.0` | Render binding requirement | Yes (explicit) |
| `PORT` | No | Provider-generated; do **not** set manually | Render runtime (normally 10000) | Yes at runtime, provider-managed |
| `NODE_ENV` | No | `production` | SchemaWise runtime policy | Yes |

The pre-deploy command selects `DATABASE_MIGRATION_URL` without changing code:

```bash
npm run db:migrate --workspace @schemawise/api -- --database-url-var DATABASE_MIGRATION_URL
```

Restrict both database values and `CSRF_SECRET` to the Render staging service.
Do not expose them to Vercel or Preview builds. Rotation of either DB credential
requires updating both URLs consistently if they use the same Neon role.

## Vercel Web: `schemawise-web-staging`

| Variable | Secret? | Staging value/pattern | Source | Required? |
| --- | --- | --- | --- | --- |
| `VITE_SCHEMAWISE_API_URL` | No; public in the bundle | `https://api.staging.<domain>`; no trailing slash | Approved Render custom origin | Yes, Production scope in the staging-only Vercel project |

Vite variables are build-time public data. A change requires a new Web build;
do not place credentials in any `VITE_*` variable.

## Separation rules

- Staging and production get distinct Neon projects/databases/roles, DB URLs,
  CSRF secrets, CORS origins, and Vercel artifacts.
- Do not add localhost, `vercel.app`, `onrender.com`, or future production
  origins to staging `CORS_ORIGINS`.
- Do not set `TRUST_PROXY`; Fastify forwarding trust remains disabled. A missing
  or invalid production `CLIENT_IP_MODE` prevents startup.
- Provider account tokens used to provision or deploy are control-plane secrets,
  not application variables. Keep them outside the application service matrix.
