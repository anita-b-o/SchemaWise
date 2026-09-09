# Cookie and CSRF policy v1

Status: implemented and verified.

## Layered policy

SchemaWise uses a host-only `HttpOnly`, `SameSite=Lax` session cookie, exact
browser-origin validation, and a session-bound CSRF token. CORS response headers
are not treated as a CSRF defense.

Register and login do not yet have a session to bind, so they do not accept an
incoming CSRF token. They are protected by auth-specific rate limits and origin
validation whenever browser provenance is present. Logout with an active session
requires both valid provenance and `X-CSRF-Token`. Future authenticated Project
mutations will use the same controls. Public computational POST routes remain
stateless and do not require CSRF.

## Token construction

The adapter computes:

```text
base64url(HMAC-SHA-256(CSRF_SECRET, "schemawise:csrf:v1\0" || sessionId))
```

`sessionId` is obtained from active-session authentication and never appears in
the response. The raw session token and its stored SHA-256 hash are not CSRF
output. No extra database state or CSRF cookie exists. `CSRF_SECRET` is mandatory
when Auth HTTP is enabled and must contain at least 32 bytes; production should
generate it from at least 32 bytes of cryptographic randomness and keep it out of
source control.

Register, login, and `/api/v1/auth/me` return `{ user, csrfToken }`. A frontend
keeps the token only in memory, restores it with `/me` after reload, and sends it
as `X-CSRF-Token`. HMAC comparison decodes the canonical 43-character base64url
value and uses `crypto.timingSafeEqual`. Missing, malformed, and mismatched values
return `403 INVALID_CSRF_TOKEN` without revoking or clearing a valid session.

Each new session has a distinct UUID and therefore a distinct CSRF token. The
token remains stable for one session; a token issued for session B cannot mutate
session A.

## Origin and Referer

`CORS_ORIGINS` is the single allowlist for CORS and request-provenance checks.
Entries must be exact serialized origins. When `Origin` exists it takes
precedence and must match scheme, host, and port exactly. There is no prefix,
substring, or suffix matching.

When `Origin` is absent but `Referer` exists, the server parses it as a URL,
extracts `.origin`, and performs the same exact comparison. A malformed or
disallowed Referer fails with `403 INVALID_CSRF_TOKEN`.

Requests with neither header are accepted for direct non-browser clients in v1.
This is deliberate: normal modern browsers include `Origin` on cross-origin POST
requests, while the session-bound header still protects authenticated mutations.
Consequently Origin checking is defense in depth, not a substitute for CSRF.
Deployments that require browser-only access may tighten this policy later.

## CORS interaction and limits

Credentialed CORS reflects only an explicitly allowed origin, sets
`Access-Control-Allow-Credentials: true`, permits `GET`, `POST`, `OPTIONS`, and
allows `Content-Type` plus `X-CSRF-Token`. It never emits wildcard ACAO. Future
browser clients must use `credentials: "include"` for all auth and Project calls;
the computational client may remain credential-free or share that fetch policy.

This design does not mitigate XSS: same-origin injected JavaScript can call
`/me`. CSP, output encoding, and dependency hygiene remain separate hardening.
A truly cross-site UI/API deployment requires review because `SameSite=Lax` is
intentional in v1.
