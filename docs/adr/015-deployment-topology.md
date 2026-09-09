# ADR 015: Same-site split Web/API deployment

- Status: accepted
- Date: 2026-09-09

## Context

SchemaWise has a static Vite Web app, persistent Fastify API, PostgreSQL,
host-only Lax session cookies, credentialed CORS, session-bound CSRF, and an
in-memory authentication rate limiter.

## Decision

Deploy Web and API independently on HTTPS subdomains of the same registrable
domain, with one API replica and one independent PostgreSQL database per
environment. Run migrations as an explicit release command before API rollout.
Use a same-origin reverse proxy only as an interim alternative when same-site
custom hostnames are unavailable.

## Consequences

The Web build receives its API origin at build time. CORS must allow exactly the
Web origin. The API cookie stays host-only, `Secure`, `HttpOnly`, `SameSite=Lax`
and `Path=/`; no Auth redesign is required. Provider-default hostnames on
unrelated sites cannot support the authenticated flow under this policy.
Horizontal API scaling is prohibited until rate-limit state is shared.
