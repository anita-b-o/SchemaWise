# Free staging environment matrix

Status: **ready for provisioning**. No value has been entered. No `VITE_*` variable may contain a secret.

## Render Free API

| Variable | Secret | Value/pattern |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon pooled URL (`-pooler`, verified TLS) |
| `DATABASE_POOL_MAX` | No | `5` |
| `AUTH_COOKIE_SECURE` | No | `true` |
| `CSRF_SECRET` | Yes | independent random >=32 bytes |
| `CORS_ORIGINS` | No | `https://<vercel-project>.vercel.app`, exact |
| `CLIENT_IP_MODE` | No | `vercel-proxy`, never `render` |
| `STAGING_PROXY_SECRET` | Yes | independent server-to-server secret with at least 32 bytes of cryptographic entropy |
| `HOST` | No | `0.0.0.0` |
| `PORT` | Provider | leave unset; Render injects it |
| `NODE_ENV` | No | `production` |

`DATABASE_MIGRATION_URL` is direct Neon access for the local controlled migration only; it is not a required API runtime variable.

## Vercel Hobby Web/proxy

| Variable | Secret | Value/pattern |
| --- | --- | --- |
| `VITE_SCHEMAWISE_API_URL` | No | `/` |
| `RENDER_API_ORIGIN` | No | `https://<render-service>.onrender.com` |
| `STAGING_PROXY_SECRET` | Yes | same server-only secret as API; no `VITE_` prefix |

The current clients append `/api/v1` themselves. Their trailing-slash normalization turns `/` into an empty base, yielding exactly `/api/v1/...`; `/api` would incorrectly yield `/api/api/v1/...`. Vercel config is static; do not assume `vercel.json` expands environment variables in rewrite destinations. The Render hostname is not secret and could be hardcoded after provision, but declarative rewrites cannot make the required request-bound secret assertion.

Set the Vercel project Root Directory to `apps/web` and keep “Include source files outside of the Root Directory” enabled so the workspace package is available. Build with `npm run build`; output is `dist`. Keep Fastify `trustProxy=false`. No raw `X-Forwarded-For`, `X-Real-IP`, or `CF-Connecting-IP` is trusted in this topology. Separate staging database/credentials/CSRF and proxy secrets from every other environment.
