# Project HTTP integration testing

Project HTTP v1 is verified at three boundaries.

Fastify injection tests use a deterministic Auth runtime and in-memory
ProjectRepository. They prove that all five routes authenticate before any
repository call, that mutations reuse the shared Origin/Referer and
session-bound CSRF controls, and that unknown body fields cannot inject identity,
revision, or timestamps. They also cover compact pagination, DTO validation,
redaction, status/error mapping, the 64 KiB adapter limit, and PUT/DELETE CORS
preflights.

PostgreSQL HTTP integration runs every migration in an isolated temporary schema
and uses real users, password hashes, sessions, and owner-scoped project SQL.
User A creates A1/A2 and user B creates B1. HTTP assertions prove scoped rows and
totals, foreign GET/PUT/DELETE as indistinguishable 404 responses, and continued
visibility of B1 to B. Two concurrent owner PUTs at revision N produce exactly
one 200 at N+1 and one 409; B still receives 404. A CSRF token from A's second
session combined with A's first cookie returns 403 and leaves the project
unchanged.

The network smoke starts Fastify on an ephemeral loopback TCP port and calls it
with `fetch`, two explicit cookie jars, an allowed Origin, and CSRF headers. It
covers register, create, list, detail, update, cross-user 404, and delete. Each
test closes the listener and pools and drops its temporary PostgreSQL schema, so
no cookies or database fixtures remain.
