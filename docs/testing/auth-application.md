# Auth Application Layer testing

## Scope

This tranche tests Authentication v1 models, validation, ports and use cases
without HTTP, cookies, CSRF, Argon2id or production token cryptography. Auth
unit tests use explicit in-memory fakes and do not connect to PostgreSQL.

The persisted session model uses a lowercase hexadecimal SHA-256 token digest.
This keeps the Application Layer independent from Node PostgreSQL `Buffer`
values. The future PostgreSQL adapter owns the conversion between hex and
`bytea`; raw bearer tokens exist only in ephemeral use-case output and input.

## Unit tests

`apps/api/tests/auth-application.test.ts` covers email canonicalization and
validation, registration and login password boundaries by Unicode code point,
transactional registration, generic credential failures, dummy verification,
30-day session expiry, session authentication and idempotent logout. The fake
registration adapter stages both records before committing them so a simulated
session insertion failure proves that no user remains.

Login accepts any string through 128 code points, including a value shorter
than the current registration minimum. This lets the hasher verify historical
credentials while registration continues to enforce 12 through 128 code
points. Neither path trims, case-folds or normalizes passwords.

## PostgreSQL migration tests

`apps/api/tests/integration/auth-migrations.test.ts` uses the existing
`DATABASE_URL` strategy. It creates a random isolated schema, applies all
versioned migrations, verifies user/session constraints and indexes, rolls
sessions and users down independently, reapplies them, and drops only that test
schema.

## Real adapters

Argon2id, cryptographic token and PostgreSQL adapter coverage is documented in
`auth-adapters-integration.md`. HTTP, cookies, CSRF, rate limiting and project
ownership remain later tranches.
