# Rollback and recovery

## Application rollback

Identify releases by Git commit SHA and retain the previous Web and API build
artifacts. Roll Web back by redeploying the previous static artifact. Roll API
back only when every already-applied database migration is backward compatible
with that build. If schema compatibility is uncertain, keep the current code and
roll forward with a corrected build/migration; do not casually run migration
`down` after writes.

Because v1 permits one API process, a restart/rollback has a short availability
gap. Fastify handles `SIGTERM`/`SIGINT` by stopping new accepts, draining/closing
the server, then ending the PostgreSQL pool. The platform grace period must be
long enough for this sequence and must not send an immediate hard kill.

## Backups

Prefer provider-managed encrypted backups. Initial production policy: daily
backups retained for 14 days, plus point-in-time recovery with at least 7 days
of history when supported by the selected plan. Staging may use shorter
retention but must support a restore rehearsal before production. Monitor backup
success and periodically restore into an isolated database; a backup is not
proven until restored.

A backup restores data/database state. A migration rollback changes schema
using `down`; these are different controls and neither substitutes for the
other.

## Data-loss restore procedure

1. Stop writes by stopping the API or otherwise isolating it; v1 has no
   maintenance mode.
2. Select and restore the approved backup/PITR point into an isolated or
   replacement database.
3. Inspect `pgmigrations`, verify expected tables/constraints and run only the
   migrations required by the chosen application SHA.
4. Point the API secret to the restored database, start the one API instance,
   and require `/ready` 200.
5. Smoke register/login or the controlled recovery account, project list/open,
   create/update/delete and anonymous analysis as appropriate.
6. Re-enable traffic, record the recovery point and preserve incident evidence.
