# Authentication adapter integration testing

The authentication adapter suite runs against PostgreSQL itself using the same
`DATABASE_URL` strategy as project persistence. Each test file creates a unique
schema, applies migrations 001–003, truncates only its own auth tables between
cases, closes every pool, and drops its schema during cleanup. Integration test
files run serially because `node-pg-migrate` protects concurrent migration runs
with a database-wide advisory lock.

Run it with:

```sh
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/TEST_DATABASE \
  npm run test:integration --workspace @schemawise/api
```

`auth-postgres-adapters.test.ts` covers explicit user row mapping and duplicate
email translation, session `bytea` round trips, active/expired lookup and
idempotent deletion. The registration adapter is exercised through a real
`BEGIN`/`COMMIT` transaction. Its mandatory rollback case inserts a valid user,
then deliberately uses a nonexistent session `user_id` to trigger PostgreSQL
foreign-key error `23503`; after rollback, both users and sessions have zero
matching rows.

The end-to-end application test uses real Argon2id, random-token, user, session
and registration adapters for register → login → authenticate → logout. It
checks that only an Argon2id PHC value is stored for the password and only the
32-byte SHA-256 digest is stored for the bearer token. Plaintext passwords and
raw session tokens are never persisted.

Malformed stored PHC input is also passed through the application boundary and
must become the generic `AUTH_INTERNAL_ERROR`; adapter or database details are
not exposed as credential failures.
