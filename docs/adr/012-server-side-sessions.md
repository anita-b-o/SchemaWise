# ADR 012: Opaque server-side sessions

## Status

Accepted

## Context

Browser authentication needs a credential that can be revoked on logout without
exposing it to frontend JavaScript. Stateless JWTs complicate immediate
revocation, and access/refresh pairs add rotation and reuse-detection machinery
without a current non-browser client requirement.

## Decision

Use server-side sessions addressed by a 32-byte cryptographically random opaque
token in an `HttpOnly` cookie. Persist only SHA-256 of the token in a unique
indexed `bytea` column. Sessions have an internal UUID, belong to one user, live
for an absolute 30 days, do not slide, and are revoked server-side on logout.
Allow multiple sessions per user.

## Consequences

- Logout and expiry are enforced centrally and immediately.
- Frontend code and web storage never receive the bearer session secret.
- Every protected request performs an indexed PostgreSQL lookup.
- Expired-row cleanup and future all-device revocation are explicit operational
  extensions; ordinary requests do not create session writes.
