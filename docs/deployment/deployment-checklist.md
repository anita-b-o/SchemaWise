# Deployment checklist

## Free staging (deployed and audited 2026-09-11)

- [x] ADR 016 accepted; proxy/client-IP code and local unit/integration tests pass.
- [x] Neon Free database isolated; direct migration 001–004 runs and current state verified read-only.
- [x] Render Free uses pooled runtime URL, pool max 5, secure cookie, exact CORS, no startup/pre-deploy migration.
- [x] Direct Render `/health` and `/ready` pass.
- [x] Vercel uses `VITE_SCHEMAWISE_API_URL=/` plus authenticated Function proxy; no frontend secrets.
- [x] `staging-smoke.md` passes; Free cold-start/latency remains an accepted non-SLA limitation and rate-limit volume is covered by tests.
- [x] Security implementation blocker resolved without provisioning, deploy, push or real secrets.

## Production

Not defined here. Never promote Free demo/staging as production-equivalent.

Final staging record: [SchemaWise v1 staging audit](../testing/schemawise-v1-staging-audit.md).
