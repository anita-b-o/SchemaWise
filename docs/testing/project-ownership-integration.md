# Project ownership PostgreSQL integration

## Scope

The real-PostgreSQL suite applies migrations 001 through 004 before inserting
project fixtures. It creates users A and B and proves that every create, lookup,
list/count, update and delete is scoped by the explicit owner ID.

Foreign project IDs and nonexistent IDs follow the same repository and
application not-found path. No authorization query looks up a project globally,
and foreign OCC attempts expose neither existence nor `actualRevision`.

## OCC coverage

For a project at revision N, two simultaneous updates by its owner with
`expectedRevision=N` yield exactly one update at N+1 and one conflict reporting
N+1. An update by another user at that exact revision returns not found.

## Migration coverage

The suite verifies `owner_id NOT NULL`, the users foreign key with `ON DELETE
RESTRICT`, and `(owner_id, updated_at DESC, id ASC)`. It also rolls 004 down and
back up. A separate schema applies only 001–003, inserts a legacy project, and
proves 004 fails with the empty-projects explanation while preserving the row
and leaving `owner_id` absent.

Run with:

```sh
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/TEST_DATABASE \
  npm run test:integration --workspace @schemawise/api
```
