# Cookie and CSRF policy v1

Status: accepted design; implementation is out of scope for this tranche.

## Threat model

An `HttpOnly` session cookie is attached by the browser without frontend code.
That prevents direct JavaScript token handling but creates CSRF risk: another
site may try to submit a state-changing request with the user's ambient cookie.
`SameSite` reduces that risk but is not the only control.

## Layered policy

V1 uses all of the following:

1. `SameSite=Lax` on the host-only session cookie.
2. Exact Origin allowlist validation for auth and project requests that can
   change server state.
3. A session-bound CSRF token in `X-CSRF-Token` for every authenticated
   state-changing request.

The protected methods are `POST`, `PUT`, `PATCH` and `DELETE` under authenticated
resource routes. For v1 this includes project create/update/delete and logout.
Computational `POST` endpoints remain public and stateless, so they do not use a
session or CSRF token. Login and register have no authenticated session token to
bind; they require strict Origin validation and rate limiting, but are exempt
from the CSRF header.

The server compares the `Origin` header exactly by scheme, host and port against
the configured allowlist. It does not use suffix or substring matching. If an
applicable browser request lacks `Origin`, a valid HTTPS `Referer` with an exact
allowed origin is the only fallback; if neither can establish the origin, the
request is rejected. The server never treats CORS response headers as a CSRF
defense by themselves.

## CSRF token

The server derives an unguessable, session-bound token using a keyed HMAC over
the raw session token (with a dedicated rotatable server CSRF secret and domain
separation). It can therefore validate the token without storing another raw
secret or adding a session-table column. The output is base64url and comparisons
use a timing-safe primitive.

Register, login and `GET /api/v1/auth/me` return the token as top-level
`csrfToken` alongside the public user. The frontend holds it in memory and sends
it as `X-CSRF-Token`; it does not put it in a cookie or persistent web storage.
After a reload, `/me` restores both current-user state and a token derived for
that session. Rotating the session on explicit login/register also rotates the
CSRF token automatically.

A missing, malformed or mismatched CSRF token fails before the protected use
case. The public response is `403 INVALID_CSRF_TOKEN`; this transport/security
code is separate from `UNAUTHENTICATED`. It reveals no session material. This
code is intentionally added by the cookie/CSRF adapter rather than the Auth
Application Layer catalogue.

## CORS interaction

Credentialed browser requests require `credentials: true` in Fastify CORS and
`credentials: "include"` in frontend fetch. Allowed methods become `GET`,
`POST`, `PUT`, `DELETE` and `OPTIONS`; allowed request headers include
`Content-Type` and `X-CSRF-Token`. Origins remain an explicit allowlist and
cannot be `*` with credentials.

The existing local allowlist contains both `localhost` and `127.0.0.1`, but an
individual dev session must use one consistently. SameSite is based on site,
not origin: different ports can be same-site, while changing between those two
hostnames is not. Production should place UI and API on HTTPS origins within the
same schemeful site. A truly cross-site deployment requires a separate review
of `SameSite=None; Secure`, third-party-cookie behavior and CSRF assumptions.

## Limits

CSRF controls do not mitigate XSS: injected same-origin JavaScript can call
`/me` and read the CSRF token. Content Security Policy, output encoding and
dependency hygiene remain necessary future hardening. The Origin fallback is
also not authorization; ownership is independently enforced in application and
repository boundaries.
