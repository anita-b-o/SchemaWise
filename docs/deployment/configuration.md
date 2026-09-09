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
| `TRUST_PROXY` | Optional exact boolean, default `false`. |
| `HOST` | Optional nonempty bind address, default `0.0.0.0`. |
| `PORT` | Optional integer 1–65535, default 3000; use the provider port. |
| `VITE_SCHEMAWISE_API_URL` | Web build-time absolute API origin. |

`apps/api/.env.example` and `apps/web/.env.example` are non-secret local
templates. Real `.env` files remain ignored. `DATABASE_URL` and `CSRF_SECRET`
belong in the provider secret manager/environment configuration, never Git or
build logs.

Production CORS has no fallback: missing `CORS_ORIGINS` fails startup. The
development-only fallback remains limited to the listed localhost Vite origins.
No wildcard is permitted with credentialed CORS.

## Proxy and IP identity

Keep `TRUST_PROXY=false` for a direct connection or when the platform exposes
the client address directly. Set it to `true` only when the API has exactly one
controlled platform proxy hop whose forwarded headers are sanitized. Auth rate
limits depend on `request.ip`; trusting arbitrary `X-Forwarded-For` permits
spoofing, while failing to trust a real proxy collapses users into the proxy IP.
Confirm the selected provider's chain before staging.

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
internal-error records. Headers containing cookies, authorization or CSRF are
redacted defensively; request bodies are not logged, so Auth passwords remain
out of logs.

Unexpected 500s log only a safe error type/code plus request context; responses
remain the sanitized public envelope. Do not add arbitrary error messages,
queries, connection strings, request bodies or secret values to production
logs. External log aggregation/metrics/tracing are deferred; provider retention,
API restart count, 5xx rate, latency, and readiness failures are the v1 baseline.
