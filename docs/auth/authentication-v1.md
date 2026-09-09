# Authentication v1

Status: application, adapters and Auth HTTP v1 implemented; public security tranche pending.

## Scope and decision

Authentication v1 uses a SchemaWise-managed email and password credential. It
supports registration, login, logout, current-user lookup and multiple
independent sessions per user. Registration starts a session immediately.

The alternatives considered were external OAuth and a hybrid of local and
external identities. OAuth avoids storing password credentials but adds provider
availability, callback, account-linking, local-development and vendor-policy
complexity. A hybrid has all of those costs plus multiple identity paths. Local
email/password has a meaningful security cost: SchemaWise must hash passwords,
rate-limit credential endpoints, avoid enumeration and operate session and CSRF
controls correctly. For the current single-application v1, its complete local
development path and simple ownership identity outweigh that cost.

OAuth, email verification, password reset, MFA, account deletion, account
linking and recovery codes are explicitly excluded. The data model must not
pretend they exist. A future external identity can be added behind the Auth
Application Layer without changing project ownership from `userId`.

## Boundaries

```text
Frontend
  -> Authentication HTTP Adapter
  -> Auth Application Layer
  -> UserRepository / SessionRepository / PasswordHasher / SessionTokenGenerator
  -> PostgreSQL and cryptographic adapters

Authenticated request
  -> session cookie resolution
  -> AuthContext { userId }
  -> Project Application Layer
  -> owner-scoped ProjectRepository
  -> PostgreSQL
```

Fastify owns cookies, headers, JSON parsing, CORS and HTTP response mapping. The
Auth Application Layer owns input policy, credential verification, session
lifecycle and public auth outcomes. Persistence adapters own database mappings
and constraints. Project use cases accept application values and never depend on
`FastifyRequest`.

## User and public DTO

The internal v1 user is:

```text
User {
  id: UserId
  email: CanonicalEmail
  passwordHash: PasswordHash
  createdAt: Instant
  updatedAt: Instant
}
```

`UserId` is a server-generated UUID v4 stored as a PostgreSQL UUID and treated
as opaque by every client. Email is mutable identity data, not a primary key.
`displayName` is omitted because no v1 flow needs it; adding optional profile
data later does not change authentication or ownership.

## Email policy

Registration and login canonicalize email in exactly this order:

1. trim surrounding whitespace with the application runtime's standard
   Unicode-aware `trim`;
2. lowercase the complete remaining string with locale-independent lowercase.

V1 stores only that canonical representation and returns it in `UserDto`; it
does not preserve a separate display spelling. The canonical result must be
nonempty, at most 254 Unicode code points, contain exactly one `@` with a
nonempty local part and domain, and contain no whitespace or control characters.
This deliberately excludes quoted addresses containing `@`. SchemaWise does not
attempt full RFC mailbox, internationalized-domain or provider-specific
normalization: it does not remove dots, strip `+` suffixes or rewrite domains
beyond lowercasing.

All repository lookup and uniqueness input is already canonical. PostgreSQL
uses `varchar(254) NOT NULL UNIQUE`; `citext` and functional indexes are not
needed. The unique constraint on the one canonical column is authoritative.
Duplicate registration races are resolved by that constraint, never by a
check-then-insert alone.

The public DTO is deliberately smaller:

```json
{
  "id": "9366d5be-e05f-4bc0-8bce-050c103c0565",
  "email": "person@example.com"
}
```

Password hashes, session IDs, token hashes and timestamps are not returned by
auth endpoints. An auth response may add a top-level CSRF token; that token is
not part of `UserDto`.

## Endpoints

| Method and route | Request | Success |
| --- | --- | --- |
| `POST /api/v1/auth/register` | exact `{ email, password }` | `201`, set session cookie, return `{ user }` |
| `POST /api/v1/auth/login` | exact `{ email, password }` | `200`, set session cookie, return `{ user }` |
| `POST /api/v1/auth/logout` | no body | `204`, revoke current DB session and clear cookie |
| `GET /api/v1/auth/me` | no body | `200 { user }` or `401 UNAUTHENTICATED` |

Unknown request fields are rejected. Register creates the user and initial
session as one application transaction. An email uniqueness race is resolved by
the database constraint and mapped to `EMAIL_ALREADY_EXISTS`.

Register automatically signs in: requiring a second transmission of the same
credential adds no security before email verification exists. Each successful
register or login issues a fresh session token. Replacing a browser cookie does
not revoke its previous server-side session in v1; multiple sessions are
intentional and each must be logged out independently. Logout-all is absent.

The response temporarily omits the final-design `csrfToken` because CSRF
runtime is not part of Auth HTTP v1. No placeholder is emitted. This adapter is
functional for same-origin/inject/curl use but is not public-ready.

Logout is not implemented by cookie deletion alone. When a valid current token
is present, its server-side session is deleted/revoked before the cookie is
cleared. The adapter clears the cookie even when it is absent, expired or
already revoked, and returns `204`; this makes logout cleanup idempotent without
disclosing session state. The next security tranche makes a valid-cookie logout
subject to CSRF controls; Auth HTTP v1 does not enforce them yet.

## Authentication resolution

For a protected request:

```text
raw cookie token
  -> validate token encoding and length
  -> SHA-256 token hash
  -> SessionRepository.findActiveByTokenHash(hash, now)
  -> userId
  -> AuthContext { userId }
```

Missing, malformed, unknown, revoked and expired sessions all fail closed as
public `401 UNAUTHENTICATED`. An expired record is never extended; it can be
deleted opportunistically. The cookie is cleared on an unauthenticated response
when practical. Session lookup may return the user identity in the same query or
perform an owner-safe user lookup; it never exposes the session record to the
project layer.

## Error model

Auth errors use the existing JSON error envelope with this minimum catalogue:

| Code | HTTP | Meaning |
| --- | ---: | --- |
| `INVALID_AUTH_REQUEST` | 400 | Invalid JSON DTO, email or password policy input |
| `EMAIL_ALREADY_EXISTS` | 409 | Canonical email already registered |
| `INVALID_CREDENTIALS` | 401 | Login email/password pair was not accepted |
| `UNAUTHENTICATED` | 401 | Protected request has no active session |
| `AUTH_RATE_LIMITED` | 429 | Auth attempt exceeded an applicable limit |
| `AUTH_INTERNAL_ERROR` | 500 | Unexpected auth/persistence failure |

`SESSION_EXPIRED` is not public in v1. The UI has the same safe action for an
expired, revoked, malformed or missing session: discard authenticated state and
prompt for login. Internal metrics may preserve the reason.

Login always returns the same `INVALID_CREDENTIALS` code, status and generic
message for an unknown email or wrong password. Registration may return
`EMAIL_ALREADY_EXISTS`: explicit signup already asks whether the address can be
registered, and a useful conflict is accepted despite this limited enumeration
surface. Rate limits still apply.

An unknown-user login performs one verification against a deployment-provided
dummy Argon2id PHC hash calibrated like normal hashes. This narrows timing
differences without claiming perfect network-level timing equality. Code must
not branch into an immediate unknown-email response.

## Planned initial rate limits

Rate limiting is not implemented in Auth HTTP v1. The next security tranche will
enforce it before expensive password hashing while preserving a generic public
response:

- login: 20 attempts per 15 minutes per source IP;
- login: 5 attempts per 15 minutes per canonical-email-and-IP pair;
- register: 5 attempts per hour per source IP.

All attempts count, not only failures, which keeps the first implementation
simple and avoids outcome-dependent counters. A successful login may clear the
email-and-IP bucket after the response. `429 AUTH_RATE_LIMITED` includes a
`Retry-After` header but does not identify which limiter fired or whether the
email exists. Proxy-derived IPs are trusted only behind explicitly configured
proxies. A single-instance in-memory store is acceptable only for local
development; production limits need a store whose scope matches all API
instances. Project-read rate limiting is not part of this tranche.

## Logging and secret handling

Passwords are never stored outside the hashing call. The following must never
be logged in plaintext or structured metadata: passwords, password hashes, raw
session tokens, cookies, CSRF tokens, `Authorization` values or complete auth
request bodies. Database errors are mapped without exposing constraints or SQL.
Logs may contain correlation ID, route, outcome code, user ID after successful
authentication, and privacy-reviewed/truncated network metadata.

## Public-exposure gate

Project routes must not be registered in a public deployment until auth use
cases and persistence, active-session resolution, owner-scoped repository
queries, authorization tests, CSRF, credentialed CORS and basic auth rate
limiting are in place. Computational endpoints remain a separate public path.
