# Authentication and project ownership architecture

Status: Auth HTTP v1 and authenticated owner-scoped Project HTTP v1 public-ready.

## System flows

SchemaWise keeps authentication, project persistence and computation as related
but distinct application flows:

```text
Frontend
  -> Authentication HTTP Adapter
  -> Auth Application Layer
  -> User / Session ports
  -> PostgreSQL and cryptographic adapters

Frontend with session cookie
  -> authentication hook -> AuthContext { userId }
  -> Project HTTP Adapter
  -> Project Application Layer
  -> owner-scoped ProjectRepository
  -> PostgreSQL

Frontend
  -> Computational HTTP Adapter
  -> Computational Application Layer
  -> Normalization Engine v1
```

The first flow establishes identity. The second authorizes durable project
resources using that identity. The third remains public, deterministic and
stateless in v1. Authentication and ownership do not alter engine types,
algorithms, DTOs or error codes, and saving a project still does not analyze it.

## Authentication design

V1 owns an email/password credential and uses opaque server-side sessions. A
canonical lower-case email identifies login but never acts as the user primary
key. Passwords are hashed with benchmark-calibrated Argon2id. A 256-bit random
session token is placed in a host-only `HttpOnly` cookie; PostgreSQL stores only
its SHA-256 digest. Sessions have a 30-day absolute lifetime, no sliding renewal
and immediate server-side revocation on logout.

The HTTP adapter turns an active session into the minimal application value:

```text
AuthContext { userId: UserId, user: PublicUser, sessionId: SessionId }
```

No Fastify request, cookie or session object enters project use cases. Auth
ports are framework-independent:

```text
UserRepository
  create(user)
  findByCanonicalEmail(email)
  findById(userId)

SessionRepository
  create(session)
  findActiveByTokenHash(tokenHash, now)
  deleteByTokenHash(tokenHash)
  deleteExpired(now)

PasswordHasher
  hash(password)
  verify(passwordHash, password)
  needsRehash(passwordHash)

SessionTokenGenerator
  generate(): raw 32-byte random token / base64url representation
  hash(rawToken): SHA-256 digest
```

Registration requires a transaction boundary spanning user and initial-session
creation. Implementations may provide transaction-bound repository instances or
an Auth unit-of-work adapter; this is an application atomicity requirement, not
a reason to expose SQL through the ports.

## Project authorization design

`Project.ownerId` is a required internal aggregate property. Create receives the
owner from `AuthContext`, never JSON. Find, list, update and delete all pass
`userId` explicitly into the repository. SQL includes `owner_id` in every
selector, count and mutation.

This placement prevents an HTTP-only authorization check from being omitted or
raced. Application signatures make missing identity visible during compilation,
while repository predicates enforce data isolation closest to access. Project
responses omit `ownerId` until sharing or transfer creates a client need.

Foreign and missing project IDs both map to `404 PROJECT_NOT_FOUND`. For OCC, the
conditional update and the follow-up revision read use `(owner_id, id)` inside
one transaction. `PROJECT_REVISION_CONFLICT` exists only when a project is
visible to that owner and its revision differs. Lists, totals and ordering are
likewise owner-scoped.

## HTTP security boundary

Cookie authentication uses credentialed CORS with exact origins, `GET`, `POST`,
`PUT`, `DELETE`, `OPTIONS`, and allowed headers `Content-Type` plus
`X-CSRF-Token`. Browser requests use `credentials: "include"`.

The host-only session cookie uses `HttpOnly`, production `Secure`,
`SameSite=Lax`, `Path=/` and a 30-day expiry. Local UI and API use the same
hostname consistently. Authenticated state changes validate exact Origin (or
strict Referer fallback) whenever provenance is present and require a
session-bound CSRF token. Register and login apply the same provenance policy
plus rate limits. Headerless direct clients remain supported. No token is kept
in browser storage.

Auth resolution, owner-scoped Project HTTP persistence, CSRF, credentialed CORS,
and auth-only rate limiting are operational. Project routes do not reuse the
login/register rate-limit buckets and introduce no project-specific limiter.

## Persistence model

Conceptual PostgreSQL tables and relation:

```text
users
  id uuid primary key
  email varchar(254) unique not null
  password_hash text not null
  created_at timestamptz not null
  updated_at timestamptz not null

sessions
  id uuid primary key
  user_id uuid not null references users(id) on delete cascade
  token_hash bytea unique not null
  expires_at timestamptz not null
  created_at timestamptz not null

projects
  ...existing columns...
  owner_id uuid not null references users(id) on delete restrict
```

Required indexes are the unique users email constraint/index, unique session
token hash, session user ID, session expiry for cleanup, and project
`(owner_id, updated_at DESC, id ASC)`. No `citext`, token table cache, JSONB
ownership field, placeholder user or RLS policy is introduced.

## Migration sequence

Version-controlled migrations are applied in this order:

1. create `users` and its canonical email constraint/index;
2. create `sessions` and its foreign key/indexes;
3. add required `projects.owner_id`, its `ON DELETE RESTRICT` foreign key and
   `(owner_id, updated_at DESC, id ASC)` index.

Migration 004 enforces the empty-projects precondition itself before any ALTER
and fails transactionally if legacy rows exist. It never deletes, guesses
owners, creates a placeholder or introduces a nullable authorization interval.
If that precondition changes, implementation pauses for a real backfill plan.

## Future test layers

Auth unit tests cover:

- exact email trim/lowercase normalization, syntax and length boundaries;
- password minimum/maximum boundaries and preservation without trimming;
- successful registration and automatic session creation;
- duplicate canonical email, including a concurrent uniqueness outcome;
- successful login, generic unknown-email/wrong-password outcomes and the dummy
  verification path;
- missing, invalid and expired session resolution;
- logout revocation and multiple-session independence.

PostgreSQL auth integration tests run migrations from empty and immediately
previous schemas, then cover canonical email uniqueness, session creation,
token-hash lookup, absolute expiry, logout deletion, user/session cascade and
the absence of raw tokens.

Ownership integration tests use at least users A and B and prove that A cannot
list/count, read, update or delete B's projects; foreign and missing IDs produce
the same outcome; create assigns only the supplied server identity; owner-scoped
ordering/total remain unchanged; and OCC succeeds/conflicts correctly only
inside the owner's scope.

Current HTTP tests additionally cover CSRF Origin/header acceptance and
rejection, cross-session tokens, credentialed PUT/DELETE CORS preflights,
rate-limit buckets, and real-TCP PostgreSQL flows. Project tests prove `401
UNAUTHENTICATED` before repository access, cross-owner `404` behavior through
`GET`, `PUT` and `DELETE`, and concurrent owner-scoped OCC.

## Implementation sequence

1. Freeze these auth/ownership documents and ADRs after review.
2. Raise and verify the supported Node runtime floor, then add the users and
   sessions migrations.
3. Add auth models, ports, validation and use cases, including transactional
   register and generic login failure behavior.
4. Add Argon2id, secure-token and PostgreSQL auth adapters with unit/integration
   tests.
5. Completed: add the guarded non-null owner migration together with `ownerId`
   and the refactor of every ProjectRepository/use-case signature and SQL
   predicate.
6. Completed: add cross-user ownership and owner-scoped OCC integration tests.
7. Completed: add the Fastify auth/session adapter and auth endpoints.
8. Completed: add CSRF validation, credentialed CORS, cookie policy and auth rate limiting.
9. Completed: add authenticated Project HTTP routes and their full HTTP
   authorization tests.
10. Add frontend login and project persistence UX in a later tranche.

No Project HTTP route should move ahead of steps 1–8. Computational routes can
remain available throughout because they neither load nor mutate projects.
