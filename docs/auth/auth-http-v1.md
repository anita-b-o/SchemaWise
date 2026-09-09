# Auth HTTP v1

Status: **public-ready** for the implemented authentication routes.

Fastify exposes register, login, me, and logout under `/api/v1/auth`. Register,
login, and me return `{ user: { id, email }, csrfToken }`; raw session tokens,
session IDs, token hashes, password data, and timestamps never enter JSON.

The `schemawise_session` cookie is host-only (`Domain` omitted), `HttpOnly`,
`Path=/`, `SameSite=Lax`, has a 30-day absolute lifetime, and uses the explicitly
configured `AUTH_COOKIE_SECURE`. Production sets it to `true`. Each register or
login creates an independent session; me returns the stable HMAC CSRF token for
that active session.

`resolveAuthenticatedUser` returns internal
`AuthContext { userId, user, sessionId }`. The session ID exists only so the HTTP
security adapter can derive CSRF and is not passed to public DTOs. Missing,
malformed, unknown, expired, and revoked sessions map to `401 UNAUTHENTICATED`.
An invalid presented cookie is cleared by me.

Logout is idempotent when the cookie is absent, malformed, expired, or revoked:
it clears the cookie and returns 204. With an active session, the request must
pass exact Origin/Referer policy and present the matching `X-CSRF-Token`; failure
returns `403 INVALID_CSRF_TOKEN` and leaves the session/cookie usable. Success
revokes only that database session, clears the cookie, and returns an empty 204.

Register is limited to 5 attempts/hour/IP. Login has simultaneous 20 attempts/15
minutes/IP and 5 attempts/15 minutes/canonical-email+IP limits. All attempts
count. The email key uses the same trim/lowercase validator as Auth Application
Layer and is SHA-256-digested before entering the store; malformed values use a
bounded, typed digest input. A 429 response is always `AUTH_RATE_LIMITED`, exposes
only `Retry-After`, and does not identify the bucket or email existence.

The rate store is process-local memory. It is suitable for the current
single-process deployment but counters are not shared across replicas; a public
multi-instance deployment must replace it with a shared store. `TRUST_PROXY`
accepts only `true` or `false`, defaults false, and must be enabled only behind a
correctly configured trusted proxy. The installed rate-limit plugin normalizes
IPv6 and uses a /64 bucket by default.

Credentialed CORS uses the same exact `CORS_ORIGINS` list as provenance checks,
sets credentials true, and permits `GET`, `POST`, `OPTIONS`, `Content-Type`, and
`X-CSRF-Token`. Browser clients use `credentials: "include"` for register, login,
me, logout, and future Project routes.

No handler logs request bodies, passwords, cookies, session or CSRF tokens.
Unexpected Auth failures remain `AUTH_INTERNAL_ERROR`; invalid credentials do
not reveal whether an email exists. Project HTTP routes and frontend auth are not
part of this tranche.
