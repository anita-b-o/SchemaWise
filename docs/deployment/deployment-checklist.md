# Deployment verification checklist

No item in this checklist authorizes a deployment by itself.

## Before staging

Follow the concrete [staging provisioning plan](staging-provisioning.md),
[staging secrets matrix](staging-secrets-matrix.md), and [staging smoke
checklist](staging-smoke.md). They do not authorize resource creation.

- [ ] Record candidate Git SHA; working tree clean; Node major 22 selected.
- [ ] `npm ci`, typecheck, unit/integration tests, build, OpenAPI parse,
      `git diff --check`, and runtime dependency audit pass.
- [ ] Web/API/PostgreSQL are isolated from production; API replicas fixed at 1.
- [ ] Secret manager contains environment-specific pooled `DATABASE_URL`, direct
      `DATABASE_MIGRATION_URL`, and `CSRF_SECRET`; logs/build output contain none.
- [ ] Exact same-site Web/API hostnames or a reviewed same-origin proxy exist.
- [ ] API config has `NODE_ENV=production`, secure cookie, exact CORS origin,
      `CLIENT_IP_MODE=render`, Fastify proxy trust disabled, `HOST=0.0.0.0`,
      provider `PORT`, and reviewed pool cap.
- [ ] PostgreSQL TLS/private-network behavior and connection limit are verified.
- [ ] Migrations directory is in the release artifact; backup/restore facilities
      are known.
- [ ] Run the migration release command once with the direct Neon URL; inspect
      `pgmigrations` and confirm the fresh `projects`/`users` tables are empty.
- [ ] Deploy API and require `/health` and `/ready`; then deploy the Web artifact
      built with the staging API URL.

## Staging smoke (mandatory)

- [ ] Operations: `/health` 200 `{status: ok}` and `/ready` 200 `{status: ready}`.
- [ ] Anonymous: load the Web app and Analyze successfully.
- [ ] Auth: Register, Me/session refresh, Logout, Login.
- [ ] Projects: Create, Update, List/Open, stale-revision OCC conflict, Delete.
- [ ] Browser: valid credentialed CORS, `Secure`/`HttpOnly`/host-only/Lax cookie,
      CSRF on mutations, and no cookie/token in JS storage or bodies.
- [ ] Logs include request IDs/status/duration and exclude passwords, cookies,
      CSRF tokens and connection strings.
- [ ] Effective client identity distinguishes two real networks and is unchanged
      by forged `X-Forwarded-For`; `Retry-After` works without attack traffic.

## Production gate and smoke

- [ ] Backup/PITR and rollback compatibility assessed before migration.
- [ ] Production uses its own DB, secrets, exact origin and Web artifact.
- [ ] Deploy by recorded SHA; migration succeeds; API remains one replica.
- [ ] Smoke `/health`, `/ready`, and one anonymous analysis.
- [ ] Use an account/project smoke only if a named controlled test account and
      cleanup/audit policy already exists; otherwise do not create production
      data merely for smoke testing.
- [ ] Observe startup, readiness, 5xx and latency logs; retain previous artifacts.
