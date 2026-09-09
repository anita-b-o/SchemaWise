# Auth HTTP integration testing

The fast unit/inject suite uses the real Auth application composition over
in-memory ports. It covers register/login/me/logout DTOs and envelopes, cookie
set/clear attributes, secure configuration, absent and inactive sessions,
multiple independent sessions, response redaction and idempotent logout.

`tests/integration/auth-http-postgres.test.ts` creates a random PostgreSQL
schema, applies the real migrations and starts Fastify on an ephemeral loopback
TCP port wired to
`PostgresAuthRegistrationRepository`, `PostgresUserRepository`,
`PostgresSessionRepository`, Argon2id and cryptographic session tokens. It
proves that register atomically persists a user and session, the browser-facing
cookie contains the raw token while PostgreSQL contains only its SHA-256 digest,
both register and login sessions authenticate with distinct CSRF tokens, a
cross-session token is rejected, and logout deletes only the presented session.

Run against a dedicated local/test database:

```sh
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/TEST_DATABASE \
  npm run test:integration --workspace @schemawise/api
```

The same automated integration is the real-network smoke: it uses Node `fetch`
for register (201), me (200), missing/wrong/cross-session CSRF failures (403),
matching logout (204), and me after revocation (401). Cookie and CSRF values stay
in process memory and are not written into the repository.
