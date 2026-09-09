# Staging and production environments

Staging and production are independent deployment units. They never share a Web
deployment, API deployment, database, database credentials, CSRF secret or CORS
allowlist.

| Resource | Staging | Production |
| --- | --- | --- |
| Web | `staging.schemawise.example` | `app.schemawise.example` or apex |
| API | `api.staging.schemawise.example` | `api.schemawise.example` |
| PostgreSQL | staging-only database | production-only database |
| `DATABASE_URL` | staging credential/database | production credential/database |
| `CSRF_SECRET` | staging-only random value | production-only random value |
| `CORS_ORIGINS` | exact staging Web origin | exact production Web origin |
| API replicas | 1 | 1 |

Both deployed APIs run with `NODE_ENV=production` and
`AUTH_COOKIE_SECURE=true`. Cookies are host-only because no `Domain` attribute
is set; the two API hostnames naturally isolate sessions. Never include
localhost or staging origins in production CORS configuration.

Each Web artifact is built for its API:

```text
staging:    VITE_SCHEMAWISE_API_URL=https://api.staging.schemawise.example
production: VITE_SCHEMAWISE_API_URL=https://api.schemawise.example
```

Do not promote the exact same Web artifact between environments while the API
URL is compile-time configuration. A future runtime-config mechanism could
change that, but is outside v1.

## Single-instance policy

The authentication rate limiter stores counters in process memory. Both
environments must enforce API replicas/processes = 1; autoscaling above one and
overlapping blue/green API processes are not supported. Multi-instance requires
a shared rate-limit store (most likely Redis), consistent key/expiry semantics,
and renewed concurrency/integration testing. It is explicitly deferred.
