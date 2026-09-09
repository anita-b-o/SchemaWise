# SchemaWise v1 readiness audit

Date: 2026-09-09  
Verdict: **SCHEMAWISE V1: READY FOR DEPLOYMENT**

## Scope and real environment

The audit covered anonymous computation, authentication, server-side session
lifecycle, manual project persistence, saved/unsaved semantics, OCC, CSRF,
rate limiting, network/database failures, ownership behavior, responsive layout,
keyboard accessibility, copy, security-facing browser traffic, migrations, and
deployment prerequisites. It added no product feature and did not deploy.

The principal run used headless Google Chrome 152 against real Vite
`http://127.0.0.1:5174`, real Fastify `http://127.0.0.1:3000`, and PostgreSQL 16
on `127.0.0.1:32770`. Migrations 001, 002, 003, and 004 were applied in order to
the isolated `schemawise_v1_readiness_audit_20260909` schema. Browser requests
used real cookies, CORS preflights, CSRF headers, Argon2id, repository queries,
and TCP listeners; mocks were limited to unit tests.

## Flows audited

- Anonymous first use: Load example, Analyze, 3NF synthesis, BCNF decomposition,
  and closure all worked without authentication. Persistence controls remained
  compact and did not obscure the mathematical workspace.
- Auth initialization: one `/auth/me` request under React StrictMode; a valid
  cookie restored the account and an absent/invalid cookie produced the
  unauthenticated state without briefly showing a false account.
- Register/login: native email/password validation, 12–128 password guidance,
  loading/disabled submit, duplicate email, unknown email, wrong password,
  success, and server/network failure were exercised. Unknown email and wrong
  password had identical public copy. Existing drafts survived both flows.
- Logout/expiry: successful logout, a network-failed logout, external session
  revocation followed by Save, and login recovery were exercised. Workspace
  content survived. A failed logout now states that the server session is still
  active and remains authenticated until a successful retry.
- Project lifecycle: New, dirty discard confirmation and Cancel, Save via POST,
  later Save via PUT, empty/incomplete drafts, Open, Delete, external deletion,
  and recreation as a new project all passed. Save never triggered Analyze.
- Saved/Unsaved: only project name and persisted schema fields affect dirty
  state. Analysis, closure, synthesis, and BCNF did not. Failed saves and
  conflicts kept Unsaved changes; Open/reload produced Saved; logout showed
  `Sign in to save`; Delete unlinked the current snapshot without erasing it.
- OCC: a second real session advanced revision N to N+1. The stale browser PUT
  returned 409, did not overwrite PostgreSQL, preserved the local draft, and
  focused the conflict. Cancel preserved local work. Reload gave an explicit
  permanent-loss warning plus a second confirmation, then loaded the exact
  server snapshot/revision. No force overwrite exists.
- CSRF: a deliberately invalid mutation token returned 403, caused exactly one
  `/auth/me`, did not replay the mutation, preserved the draft, and succeeded on
  manual retry. A CSRF token from another valid session returned 403.
- Rate limit: the sixth login attempt for one email/IP window returned 429 with
  safe `Too many attempts` copy, no bucket detail, no loop, and a re-enabled
  button. The server emitted `Retry-After`; the current client does not expose
  response headers, so it cannot show the exact wait.
- Network failure: with Fastify stopped, Analyze, Save, Open projects, and Login
  showed scoped retryable errors and preserved drafts/forms. All succeeded by
  explicit retry after Fastify returned, without a page reload.
- Database failure: with Fastify alive and isolated PostgreSQL unavailable,
  Save and Login returned safe generic errors without SQL details and preserved
  UI state. The pool recovered after the disposable database was recreated and
  migrated. The local test container was auto-remove-on-stop, so its disposable
  test data was recreated; no production or user data was involved.
- Multi-session: two sessions remained independently valid; logging out one did
  not affect the other, cross-session CSRF failed, and concurrent project edits
  followed OCC.
- External missing/foreign resources: API ownership integration proves foreign
  and missing IDs share 404. In Chrome, external deletion during Save and Delete
  preserved the draft, removed the stale association, explained recovery, and
  made the next Save a POST.

## Viewports and responsive result

Chrome was checked at 320×720, 390×844, 768×1024, 1280×800, and 1440×900 with
initial, analyzed, auth, project-list, confirmation, and conflict states. Each
had `scrollWidth <= innerWidth`, no element crossing horizontal viewport bounds,
and 44px minimum button height. Forms, project rows, actions, panels, results,
and confirmations wrapped into readable single-column layouts where needed.

## Accessibility result

The semantic/keyboard pass covered anonymous input, auth mode and fields,
project name/actions, project list, discard/delete confirmations, conflict,
and logout. Controls use native inputs/buttons/fieldsets/details with labels,
autocomplete, disabled and busy states. Focus rings were visible at 3px. Auth
and project panels focus their first task and return focus when closed; inline
confirmations focus Cancel; conflicts focus their heading; completed Open/New
focus Project name. Alerts and live status regions announce failures and busy
results. These are inline panels rather than modal dialogs, so no focus trap is
required. No automated screen-reader or axe run was performed.

## Security and browser observations

- The browser cookie was host-only, HttpOnly, Path `/`, SameSite Lax, and absent
  from `document.cookie`, localStorage, sessionStorage, and JSON responses.
  Local audit correctly used `Secure=false`; production must use `true` over
  HTTPS.
- Credentialed CORS reflected only `http://127.0.0.1:5174`; a disallowed origin
  received no `Access-Control-Allow-Origin`. There was no wildcard credentialed
  origin.
- Authenticated POST/PUT/DELETE sent the session-bound CSRF header. GET and
  public computational requests did not require it. Register/login used origin
  validation and rate limiting rather than a pre-session token.
- Project payloads/responses contained no `ownerId`. Auth JSON contained no raw
  session token, session ID, password, or password hash. Fastify logs contained
  route/request metadata, not bodies or credentials.
- `npm audit --omit=dev` reported zero vulnerabilities.

## Issues and fixes

| Severity | Finding | Resolution |
| --- | --- | --- |
| High | A 404 while saving an externally deleted current project retained its dead ID, causing every later Save to PUT forever. | Unlink only the unavailable current project, preserve name/schema, explain recovery, and make the next Save POST. |
| High | OCC reload did not explicitly state that unsaved local changes would be lost and replaced them in one action. | Added explicit permanent-loss copy and a second `Reload and discard` confirmation. |
| High | Network-failed Logout cleared React auth state even though the HttpOnly cookie/server session remained active. | Keep authenticated state, report that the session is still active, and permit explicit retry. |
| Medium | StrictMode initialization performed two `/auth/me` requests. | Guarded initialization per mounted provider; real Vite now sends one. |
| Medium | `Sync unavailable` exposed implementation language after logout/expiry. | Replaced with `Sign in to save`. |
| Medium | Removed inline panels/confirmations could leave focus on `body`. | Added focus entry/return for auth, projects, confirmations, conflict, Open, and New. |
| Low | A list with more than 20 projects gave no indication that it was truncated. | Added `Showing the 20 most recently updated projects.` when `total` exceeds the rendered list. |

No Critical or High issue remains.

## Accepted v1 limitations

- Refresh: authentication recovers through `/auth/me`, while the in-memory
  workspace and project association reset. The UI explicitly says the draft
  stays in the browser tab, and saved work can be reopened. With router and
  localStorage intentionally excluded, this is a documented deferred limitation,
  not a deployment blocker.
- Project list: only the 20 most recently updated projects are accessible in the
  UI. The truncation is now explicit. Pagination/search remain deferred. This is
  acceptable for initial v1 usage but should be prioritized once accounts can
  realistically exceed 20 active projects.
- Rate limiting is process-local. Production v1 must run one API process/replica;
  a multi-instance deployment requires a shared limiter before scaling out.

## Validation

- Web: 72 tests passed.
- API unit: 100 tests passed.
- Normalization Engine: 174 tests passed.
- Unit total: 346 tests passed.
- PostgreSQL integration: 28 tests passed.
- Total: 374 tests passed.
- TypeScript typecheck: passed for all workspaces.
- Production build: passed; Vite emitted the static web bundle and API/engine
  TypeScript compiled.
- OpenAPI 3.1 parse: passed, 11 paths.
- `git diff --check`: passed.
- Runtime dependency audit: zero vulnerabilities.

## Deployment requirements and blockers

Deployment itself remains intentionally unimplemented. A deployment plan must
provide:

- static hosting for `apps/web/dist`, built with the production API URL;
- a supported Node.js 22+ runtime for the compiled Fastify API, with its chosen
  `HOST`/`PORT` reachable through the platform proxy;
- PostgreSQL plus backups, connection limits, monitoring, and the production
  `DATABASE_URL`;
- migrations 001→002→003→004 before API startup. Fresh production is valid;
  004 intentionally fails when `projects` is nonempty and would then require a
  real owner backfill plan;
- HTTPS and `AUTH_COOKIE_SECURE=true`;
- exact `CORS_ORIGINS`; UI and API should remain same-site unless cookie policy
  is deliberately redesigned;
- correct `TRUST_PROXY` for the actual proxy chain so rate-limit IP identity is
  trustworthy;
- a cryptographically random, secret `CSRF_SECRET` of at least 32 bytes;
- build/start commands: root `npm run build`, API `npm start --workspace
  @schemawise/api`, and `npm run db:migrate --workspace @schemawise/api` with
  production database configuration;
- one API instance for v1, or a shared rate-limit store before multiple replicas.

There is no remaining functional deployment blocker. Provider configuration,
secrets, database provisioning, migrations, and hosting are deployment work,
not missing application behavior.

## Health/readiness recommendation

`GET /health` and `GET /ready` are not implemented; `/health` currently returns
the safe API 404 envelope. They are recommended before an orchestrated rollout:
`/health` should prove the process/event loop is serving, while `/ready` should
perform a bounded PostgreSQL readiness check. They are not a v1 functional
blocker if the selected platform can use process/TCP health checks. If the
platform mandates HTTP probes, adding the required endpoint becomes a deployment
task before launch.

## Environment variables verified from code

| Variable | Runtime behavior |
| --- | --- |
| `DATABASE_URL` | API required; startup fails without it. |
| `AUTH_COOKIE_SECURE` | API required; exact `true` or `false`, production `true`. |
| `CSRF_SECRET` | API required; minimum 32 UTF-8 bytes. |
| `CORS_ORIGINS` | API optional local default, but production must set exact comma-separated origins. |
| `TRUST_PROXY` | API optional, defaults `false`; accepts only `true`/`false`. |
| `HOST` | API optional, defaults `0.0.0.0`. |
| `PORT` | API optional, defaults `3000`. |
| `VITE_SCHEMAWISE_API_URL` | Web build optional local default `http://127.0.0.1:3000`; production must set it when the API URL differs. |

## Deferred improvements

Router/deep-linked project restore, local draft recovery across refresh,
pagination beyond 20 projects, a shared distributed rate limiter, HTTP
health/readiness probes, stronger operational observability, CSP review, and
automated screen-reader/axe coverage are deferred. Autosave, password reset,
email verification, OAuth, sharing, collaboration, archive, search, analytics,
and admin remain explicitly outside v1.

## Final decision

All real auth, persistence, OCC, CSRF, responsive, accessibility, failure, test,
build, and security gates pass after the fixes above, with no remaining
Critical/High issue or functional deployment blocker.

**SCHEMAWISE V1: READY FOR DEPLOYMENT**
