# Neon Free staging provisioning evidence

Validated: 2026-09-09

Status: **READY** for the Render Free API provisioning tranche. This record covers only Neon PostgreSQL; no API, proxy, frontend, DNS, production resource, seed, user, session, or project data was provisioned.

## Resource configuration

| Setting | Validated value |
| --- | --- |
| Plan | Neon Free (`free_v3`) |
| Project | `schemawise-staging` |
| Region | AWS N. Virginia (`aws-us-east-1`) |
| PostgreSQL | 17.11 |
| Branch | `main` (default, persistent) |
| Database | `schemawise_staging` |
| Runtime endpoint | pooled, `ep-***-pooler.c-11.us-east-1.aws.neon.tech` |
| Migration endpoint | direct, `ep-***.c-11.us-east-1.aws.neon.tech` |
| TLS | `sslmode=verify-full`, `channel_binding=require` |

The future Render API receives the pooled URL as `DATABASE_URL` and keeps `DATABASE_POOL_MAX=5`. Controlled migrations receive the direct URL as `DATABASE_MIGRATION_URL`. Real credentials and connection strings are intentionally omitted.

## Migration and schema evidence

The repository migration command completed successfully for:

1. `001_create_projects`
2. `002_create_users`
3. `003_create_sessions`
4. `004_add_project_owner`

The database had no tables and no project rows before migration, so the migration 004 empty-project guard passed without data deletion. A subsequent direct-endpoint invocation reported no pending migrations.

`public.pgmigrations` contains exactly the four names above. The resulting base tables are `projects`, `users`, `sessions`, and `pgmigrations`.

Validated schema details:

- `projects.owner_id` is non-null and references `users(id)` with `ON DELETE RESTRICT`; `schema_json` is non-null `jsonb`; `projects_revision_positive` enforces `revision > 0`.
- `users.email` is non-null and unique; `password_hash` is non-null text.
- `sessions.token_hash` is non-null `bytea` and unique; `user_id` is non-null and references `users(id)` with `ON DELETE CASCADE`.

Post-migration application row counts were `projects=0`, `users=0`, and `sessions=0`. No seed or HTTP/auth operation was run.

## Connectivity

A pooled `SELECT 1` passed through the compiled `createProjectPool` implementation, including clean pool shutdown. The pool used `DATABASE_POOL_MAX=5`. The controlled migration command also connected successfully through the direct endpoint.

## Free-plan operating limits

The current Neon Free limits relevant to this disposable staging environment are 100 CU-hours per project per month, 0.5 GB storage per project, 5 GB monthly public network transfer, ten branches per project, and compute sizes up to 2 CU. Instant restore history is limited to six hours or 1 GB of data changes, whichever comes first.

Free compute suspends after five inactive minutes and wakes on the next connection, which can add cold-start latency. No keepalive is configured. Combined Neon and future Render cold starts make this environment unsuitable for latency benchmarking. Restore history is convenience recovery for disposable staging, not a production backup strategy.

Sources checked 2026-09-09: [Neon pricing](https://neon.com/pricing), [scale to zero](https://neon.com/docs/introduction/scale-to-zero), and [network transfer](https://neon.com/docs/introduction/network-transfer).

## Secret handling

Connection strings were passed to local processes through non-echoed standard input and environment variables, never command-line arguments or tracked files. A credential that was echoed by an early local PTY invocation was immediately rotated in Neon before final validation. Repository scans and Git status are the final hygiene gate.
