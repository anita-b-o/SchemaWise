# ADR 014: Session cookie and CSRF policy

## Status

Accepted

## Context

An `HttpOnly` session cookie keeps bearer credentials out of frontend code but
the browser attaches it automatically, creating CSRF risk. SameSite alone does
not cover every deployment/navigation case, and CORS governs response access
rather than server-side authorization.

## Decision

Use a host-only session cookie with `HttpOnly`, production `Secure`,
`SameSite=Lax`, `Path=/` and the session's 30-day absolute expiry. Authenticated
mutations require both exact Origin allowlist validation (strict Referer fallback
only when Origin is absent) and a session-bound HMAC CSRF token sent in
`X-CSRF-Token`. Login/register require Origin validation and rate limiting.
Enable credentialed CORS only for explicit origins and have the frontend use
`credentials: "include"`.

## Consequences

- The browser does not expose the session bearer token to JavaScript or web
  storage.
- The frontend must obtain a CSRF token from register/login/`me` and attach it
  to project mutations and logout.
- Local UI/API hosts must use `localhost` or `127.0.0.1` consistently.
- A genuinely cross-site production deployment requires revisiting SameSite and
  third-party-cookie assumptions; `SameSite=None` is not enabled implicitly.
