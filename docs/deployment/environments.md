# Staging and production environments

The exact staging provisioning choices and acceptance procedure are in
[staging-provisioning.md](staging-provisioning.md),
[staging-secrets-matrix.md](staging-secrets-matrix.md), and
[staging-smoke.md](staging-smoke.md).

Staging and production are independent deployment units. They never share a Web
deployment, API deployment, database, database credentials, CSRF secret or CORS
allowlist.

| Resource | Staging | Production |
| --- | --- | --- |
| Web | `staging.schemawise.example` | `app.schemawise.example` or apex |
| API | `api.staging.schemawise.example` | `api.schemawise.example` |
| PostgreSQL | staging-only database | production-only database |
| `DATABASE_URL` | staging credential/database | production credential/database |
| `DATABASE_MIGRATION_URL` | staging direct credential/database URL | production direct credential/database URL |
| `CSRF_SECRET` | staging-only random value | production-only random value |
| `CORS_ORIGINS` | exact staging Web origin | exact production Web origin |
| `CLIENT_IP_MODE` | `render` | re-evaluate for selected production topology |
| API replicas | 1 | 1 |

Both deployed APIs run with `NODE_ENV=production` and
`AUTH_COOKIE_SECURE=true`. Cookies are host-only because no `Domain` attribute
is set; the two API hostnames naturally isolate sessions. Never include
localhost or staging origins in production CORS configuration.

Fastify forwarding trust remains disabled. Staging auth limits resolve identity
from Render's overwritten `CF-Connecting-IP` only because `CLIENT_IP_MODE=render`
is explicit. Direct/local mode uses the socket address and ignores forwarding
headers. Production must select and review its mode independently.

Each Web artifact is built for its API:

```text
staging:    VITE_SCHEMAWISE_API_URL=https://api.staging.schemawise.example
production: VITE_SCHEMAWISE_API_URL=https://api.schemawise.example
```

Do not promote the exact same Web artifact between environments while the API
URL is compile-time configuration. A future runtime-config mechanism could
change that, but is outside v1.

The runtime `DATABASE_URL` is the Neon pooled URL. Release migrations use a
direct URL for the same branch/database, selected by the migration CLI without
changing application code. The two environments never share either URL.

## Single-instance policy

The authentication rate limiter stores counters in process memory. Both
environments must enforce API replicas/processes = 1; autoscaling above one and
overlapping blue/green API processes are not supported. Multi-instance requires
a shared rate-limit store (most likely Redis), consistent key/expiry semantics,
and renewed concurrency/integration testing. It is explicitly deferred.
