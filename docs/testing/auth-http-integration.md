# Auth HTTP integration testing

The fast unit/inject suite uses the real Auth application composition over
in-memory ports. It covers register/login/me/logout DTOs and envelopes, cookie
set/clear attributes, secure configuration, absent and inactive sessions,
multiple independent sessions, response redaction and idempotent logout.

`tests/integration/auth-http-postgres.test.ts` creates a random PostgreSQL
schema, applies the real migrations and injects HTTP through Fastify wired to
`PostgresAuthRegistrationRepository`, `PostgresUserRepository`,
`PostgresSessionRepository`, Argon2id and cryptographic session tokens. It
proves that register atomically persists a user and session, the browser-facing
cookie contains the raw token while PostgreSQL contains only its SHA-256 digest,
both register and login sessions authenticate, and logout deletes only the
presented session.

Run against a dedicated local/test database:

```sh
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/TEST_DATABASE \
  npm run test:integration --workspace @schemawise/api
```

The manual network smoke starts the built Fastify server against an isolated
migrated database and uses a temporary curl cookie jar for register (201), me
(200), logout (204), and me again (401). The jar must remain outside the repo
and be deleted after the run.
