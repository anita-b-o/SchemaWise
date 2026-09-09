# Deployment checklist

## Free staging (ready for provisioning)

- [x] ADR 016 accepted; proxy/client-IP code and local unit/integration tests pass.
- [ ] Neon Free database isolated; direct migration 001–004 runs and initial state verified.
- [ ] Render Free uses pooled runtime URL, pool max 5, secure cookie, exact CORS, no startup/pre-deploy migration.
- [ ] Direct Render `/health` and `/ready` pass.
- [ ] Vercel uses `VITE_SCHEMAWISE_API_URL=/` plus authenticated Function proxy; no frontend secrets.
- [ ] `staging-smoke.md` passes: cookie, provenance, direct URL, client IP, limits, cold start and timeout gates.
- [x] Security implementation blocker resolved without provisioning, deploy, push or real secrets.

## Production

Not defined here. Never promote Free demo/staging as production-equivalent.
