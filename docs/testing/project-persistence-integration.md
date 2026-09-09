# Project persistence integration tests

## Strategy

The persistence integration suite runs against PostgreSQL itself; SQLite and
in-memory SQL substitutes are not supported. The caller supplies a standard
PostgreSQL URL in `DATABASE_URL`. Each run creates a uniquely named schema,
applies migrations there, and drops only that schema during cleanup. This keeps
the suite isolated from existing application tables while allowing it to use a
shared local test database.

The test database user must be allowed to create and drop schemas. Use a
dedicated local/test database and never point the suite at production.

## Commands

From the repository root:

```sh
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/TEST_DATABASE \
  npm run test:integration --workspace @schemawise/api
```

Application migrations use the same environment variable:

```sh
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE \
  npm run db:migrate --workspace @schemawise/api

DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE \
  npm run db:rollback --workspace @schemawise/api
```

No migration runs when the API module is imported. Pool creation and shutdown
are explicit so tests and future process composition can close every connection.

## Coverage

The suite verifies migration up/down, row constraints, JSONB round trips,
incomplete drafts, lookup/list/pagination/order, atomic replacement, revision
increments, conflict classification, two simultaneous OCC updates, and hard
delete. Create, update, and delete each rely on PostgreSQL statement atomicity.
List uses separate `count` and row queries under normal `READ COMMITTED`
semantics; an exact cross-statement snapshot is not guaranteed in v1.
