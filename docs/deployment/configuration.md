# Deployment configuration

Configuration is loaded and validated before the pool or HTTP server is
created. Startup errors name the invalid variable but do not print its value.

| Variable | Policy |
| --- | --- |
| `NODE_ENV` | `production` in staging and production; activates production fail-fast rules. |
| `DATABASE_URL` | Required valid `postgres://` or `postgresql://` URL; secret. |
| `DATABASE_POOL_MAX` | Optional integer 1–20; default 5. Coordinate with provider connection limits. |
| `AUTH_COOKIE_SECURE` | Required boolean; must be `true` with `NODE_ENV=production`. |
| `CSRF_SECRET` | Required; at least 32 UTF-8 bytes of cryptographically random secret material. |
| `CORS_ORIGINS` | Comma-separated serialized origins; explicit, nonempty and exact in production. |
| `CLIENT_IP_MODE` | `direct`, `render`, or `vercel-proxy`; required explicitly in production, defaults to `direct` in development/tests. Free staging uses `vercel-proxy`. |
| `STAGING_PROXY_SECRET` | Required only with `CLIENT_IP_MODE=vercel-proxy`; shared server-only HMAC secret with at least 32 bytes. Never use a `VITE_` prefix. |
| `HOST` | Optional nonempty bind address, default `0.0.0.0`. |
| `PORT` | Optional integer 1–65535, default 3000; use the provider port. |
| `VITE_SCHEMAWISE_API_URL` | Web build-time API base: absolute origin in production or `/` for the accepted same-origin Free staging proxy; current clients append `/api/v1`. |
| `RENDER_API_ORIGIN` | Vercel Function server-only fixed upstream origin. Hosted values require HTTPS and may not contain credentials, path, query, or fragment. Never use a `VITE_` prefix. |

`apps/api/.env.example` and `apps/web/.env.example` are non-secret local
templates. Real `.env` files remain ignored. `DATABASE_URL`, `CSRF_SECRET` and `STAGING_PROXY_SECRET`
belong in the provider secret manager/environment configuration, never Git or
build logs.

Production CORS has no fallback: missing `CORS_ORIGINS` fails startup. The
development-only fallback remains limited to the listed localhost Vite origins.
No wildcard is permitted with credentialed CORS.

## Proxy and IP identity

`render` is valid only for direct browser-to-Render traffic. It is not valid
through a Vercel hop. In `vercel-proxy`, the API requires the HMAC assertion
defined in [the proxy architecture](../architecture/vercel-render-proxy.md).
Missing or invalid configuration fails startup without logging the secret.

Fastify always has `trustProxy=false`; do not add `TRUST_PROXY`. In `direct`
mode, auth rate limits use and validate the socket peer and ignore forwarding
headers. In `render` mode, they use a single valid `CF-Connecting-IP` because
Render documents that its Cloudflare edge overwrites caller input on every web
service request. Missing or malformed identity is rejected. Never enable Render
mode on an origin reachable without that edge, and re-review the contract when
the provider or topology changes. `vercel-proxy` never falls back to any of
those sources.

## PostgreSQL connections and TLS

One API instance starts a pool with max 5, a 5-second connection acquisition and
query timeout, and 30-second idle timeout. Five connections leave headroom on
small managed plans for migrations, administration and backups. Increase only
from observed saturation and within the database's connection cap.

TLS behavior is delegated to `pg` through `DATABASE_URL`; the adapter never sets
`rejectUnauthorized: false`. Prefer provider private networking when it is
encrypted/explicitly supported. For public database endpoints, use the
provider's documented verified TLS URL, preferably `sslmode=verify-full` with
the required CA trust. Do not append `sslmode=no-verify` or enable libpq
compatibility with a verification-weakening mode for convenience.

## Secrets rotation

Rotating `CSRF_SECRET` invalidates issued CSRF tokens but not server-side
sessions; clients can obtain a new token through `/auth/me`. Rotate PostgreSQL
credentials in the provider, update `DATABASE_URL`, restart the sole API
instance, verify `/ready`, and revoke the old credential. Plan the brief restart
because v1 has no second replica.

## Logging

Fastify emits JSON to stdout with its native request ID, method, URL, response
status and response time. Use `reqId` to correlate request-start, completion and
internal-error records. Headers containing cookies, authorization, CSRF, proxy
signatures or asserted client IP are redacted defensively; request bodies are
not logged, so Auth passwords remain
out of logs.

Unexpected 500s log only a safe error type/code plus request context; responses
remain the sanitized public envelope. Do not add arbitrary error messages,
queries, connection strings, request bodies or secret values to production
logs. External log aggregation/metrics/tracing are deferred; provider retention,
API restart count, 5xx rate, latency, and readiness failures are the v1 baseline.
