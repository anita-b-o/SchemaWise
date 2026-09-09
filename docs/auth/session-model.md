# Session model v1

Status: accepted design; Application Layer contract and database migration implemented.

## Decision

Use opaque, server-side sessions transported by an `HttpOnly` cookie. Stateless
JWT access tokens were rejected for v1 because immediate logout/revocation,
credential invalidation and secret leakage handling require additional state or
short-lived/refresh-token machinery. Access-plus-refresh tokens add rotation,
reuse detection and two-token lifecycle complexity without a current mobile or
third-party client. A raw opaque token backed by a database row gives the
application one simple authentication and revocation boundary.

The cost is one indexed database lookup for each authenticated request and
periodic expiry cleanup. SchemaWise's current scale and already-required
PostgreSQL dependency make that trade appropriate. Caching can be evaluated from
measurements later, but must preserve revocation semantics.

## Logical model

```text
Session {
  id: SessionId
  userId: UserId
  tokenHash: SessionTokenHash
  expiresAt: Instant
  createdAt: Instant
}
```

`SessionId` is a server-generated UUID v4 used as an internal, non-secret row
identity. The unique credential lookup is `tokenHash`. `lastUsedAt` is omitted:
v1 has no sliding expiry or activity UI, and updating every request would create
write amplification. Multiple session rows per user are allowed. “Logout all
devices” and per-device session management are future features.

## Token generation and storage

The token generator obtains 32 cryptographically random bytes from Node's
`crypto.randomBytes(32)` and encodes them as unpadded base64url (43 characters).
A UUID v4 is not used as the session secret. The raw token exists only in the
cookie and transient request/application memory; it is never stored or logged.

Before persistence or lookup, the server computes SHA-256 over the exact token
bytes and stores the fixed 32-byte digest as `bytea`. A unique constraint on the
digest both supports lookup and treats the cryptographically negligible
collision as a creation failure that must generate a new token. A slow password
hash is unnecessary because the token has 256 bits of entropy. Database
exfiltration therefore does not directly yield usable bearer session tokens.

Malformed encodings or lengths fail before lookup as `UNAUTHENTICATED`. Digest
comparison is performed by the indexed database lookup; any in-process secret
comparison uses a timing-safe primitive.

## Lifetime and rotation

Sessions expire exactly 30 days after creation. This is an absolute lifetime:
requests do not extend it, and `lastUsedAt` is not written. Both the database
`expires_at` and cookie `Max-Age=2592000`/matching `Expires` are set from the same
server decision; the database timestamp is authoritative.

Register and every explicit successful login create a new session and token.
If the same browser already has a valid session, that current row is revoked as
its cookie is replaced. There is no rotation on ordinary requests and no refresh
token in v1. Security-sensitive future events such as password change can revoke
all sessions when those features are designed.

## Persistence behavior

`findActiveByTokenHash(hash, now)` returns a session only when `expires_at > now`
and its user still exists. Logout deletes the matching current row (hard delete
is sufficient for v1); expired rows may be deleted opportunistically and by a
future cleanup job. Authentication never accepts a row merely because its token
hash exists.

Session creation and replacement must set the cookie only after persistence
succeeds. On logout, failure to revoke a valid DB session is an internal error;
the server must not report a successful logout while knowingly leaving the
bearer credential active.

## Cookie

The session cookie is named `schemawise_session` and has:

- `HttpOnly` always;
- `Secure` in production and off only for plain-HTTP local development;
- `SameSite=Lax`;
- `Path=/`;
- no `Domain` attribute (host-only);
- `Max-Age=2592000` and a matching absolute `Expires` value.

`Lax` gives useful cross-navigation behavior while blocking cookies on most
cross-site subrequests. `Strict` offers a narrower ambient-cookie surface but
can unexpectedly discard login state after legitimate external navigation. The
additional Origin and CSRF-token controls mean `Lax` is the better v1 balance.
If production deploys the UI and API on genuinely different sites rather than
different origins of one schemeful site, this decision must be reopened;
`SameSite=None; Secure` is not an automatic substitution.

Local development must use one hostname consistently, preferably `localhost`
for both Vite and the API (or `127.0.0.1` for both). Ports do not define cookie
scope, while `localhost` and `127.0.0.1` are different hosts/sites. Omitting
`Domain` avoids accidental subdomain-wide credentials. Production also keeps a
host-only cookie unless a concrete cross-subdomain server need is demonstrated.

The frontend never copies the session token into JavaScript and never stores
auth credentials in `localStorage` or `sessionStorage`. Cross-origin fetches to
the API use `credentials: "include"`.
