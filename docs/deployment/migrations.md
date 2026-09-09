# Production migration strategy

Migrations are an explicit pre-deploy/release step, never an import side effect
or API startup action:

```bash
npm run db:migrate --workspace @schemawise/api
```

Run from a release environment containing `apps/api/migrations` and production
dependencies, against the target environment's `DATABASE_URL`, before starting
the new API build. Only one migration job runs at a time. On a fresh database,
node-pg-migrate applies in filename order:

1. `001_create_projects`
2. `002_create_users`
3. `003_create_sessions`
4. `004_add_project_owner`

Migration 004 intentionally locks `projects` and fails unless it is empty. That
is valid for a fresh v1 deployment. Any nonempty pre-v1 database requires a
separately reviewed ownership backfill; do not bypass its guard.

node-pg-migrate records applied names and timestamps in its standard
`pgmigrations` table (in `public` with the current CLI defaults). Do not create a
parallel migration ledger. Verify that table and application tables after the
release step.

The mechanical one-step rollback command is:

```bash
npm run db:rollback --workspace @schemawise/api
```

It is not an automatic incident response after traffic exists. Prefer additive,
backward-compatible migrations and roll-forward fixes. Before a risky migration,
confirm a recent restorable backup/PITR point and rehearse restore in staging.
Use `down` only when the migration is known reversible, no newer code/data
depends on it, and the potential data loss has been explicitly accepted.
