# ADR 011: Local email and password authentication

## Status

Accepted

## Context

Public Project API operations need a stable user identity. External OAuth would
avoid local passwords but adds provider availability, callback, account-linking
and local-development dependencies. A hybrid identity system carries both sets
of costs. V1 needs one complete, testable path and no provider-specific feature.

## Decision

Use locally managed email/password credentials for Authentication v1. Users have
server-generated UUID v4 identities. Store one canonical `trim` + lowercase
email with a unique constraint and a password hash; omit `displayName`. Keep the
Auth Application Layer behind repository and cryptographic ports so external
identities can be introduced deliberately later.

## Consequences

- Local development and ownership tests do not depend on an external provider.
- SchemaWise assumes responsibility for password hashing, timing behavior,
  credential rate limiting, secret redaction and account-security operations.
- OAuth, verification, reset, MFA and account linking remain out of scope.
- Project ownership depends only on stable `userId`, not email or login method.
