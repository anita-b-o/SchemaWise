# Project Recovery + Deep Links v1.2 staging audit

Date: 2026-09-11  
Environment: staging only  
Classification: **PROJECT RECOVERY V1.2 STAGING: PASS WITH DEFERRED CHECKS**

This audit exercised the deployed Vercel Web and Function proxy against the
existing Render staging API. It did not deploy or modify Render, query or
modify Neon directly, change secrets, create a tag, or touch production.

## Deployed revisions

| Component | Revision | Evidence |
| --- | --- | --- |
| Source | `2db3dafc53c0ee28780a1b2733d7ef26e425a5cb` | pushed `master`; local and `origin/master` matched |
| Vercel | `2db3dafc53c0ee28780a1b2733d7ef26e425a5cb` | deployment `dpl_3P17ZYRQDZSZN5UAH8Uy4NeWdEXa`, READY; public staging alias attached |
| Render | `635d41774b6acb939d6b09cb317b6ea1153645fc` | existing live deployment; intentionally unchanged because `apps/api` had no product diff |

Vercel reported Vite, Node 22.x, one Node Function, successful cloning of
`2db3daf`, 77 transformed modules, and a completed build/deployment. The
ordered deployed configuration is:

1. `/api/v1/(.*) -> /api/proxy`
2. `/(.*) -> /index.html`

The build log reported two moderate development-dependency findings during the
full install. The release gate `npm audit --omit=dev` reported zero runtime
vulnerabilities.

## Health, routing, and proxy

- Direct Render `GET /health`: 200, JSON `{"status":"ok"}`.
- Direct Render `GET /ready`: 200, JSON `{"status":"ready"}`.
- Vercel `POST /api/v1/analysis`: 200 JSON for `R(A,B,C)`, `A -> B`,
  `B -> C`; candidate key `{A}`, 2NF true, 3NF false, BCNF false.
- Direct refresh of a valid `/projects/<uuid>` returned the SPA document,
  recovered auth, issued one project GET, hydrated Saved state, and focused
  the workspace H1. It did not restore or initiate analysis, Closure, or
  transformations.
- Direct `/projects/foo`: document 200, `Invalid project link.`, title
  `SchemaWise`, and zero project-detail GETs.
- Direct `/foo`: document 200, `Page not found.`, title `SchemaWise`.
- Browser network logs showed `/api/v1/analysis`, `/api/v1/auth/me`, and
  `/api/v1/projects` as Fetch requests with API statuses, never HTML fallback.
  Independent HTTP checks confirmed `application/json; charset=utf-8`.
- Direct `/api/proxy`: 404 JSON `PROXY_ROUTE_NOT_FOUND`.

## Real staging flows

| Flow | Result | Observed requests |
| --- | --- | --- |
| A — create / refresh | PASS. Created A, adopted `/projects/A`, refreshed, recovered auth, restored exact schema as Saved, and kept derived resources idle. | create: 1 POST, 0 immediate GET; refresh: 1 auth GET + 1 project GET |
| B — open / Back / Forward | PASS. A -> B -> Back A -> Forward B retained route, title, H1 focus, and history. | exactly 1 project GET for each committed hydration |
| C — dirty blocker | PASS. Back showed one prompt; Stay retained dirty B; a second Back plus Discard committed the original POP to A. | 0 GET while blocked; 1 GET after discard |
| D — Save New adoption | PASS. Root draft Save POSTed and replaced the URL with `/projects/A` without hydration. Refresh then hydrated once. | 1 POST, 0 immediate GET; refresh 1 GET |
| E — delete current | PASS. Delete moved to `/`, preserved the draft, and the next Save created a new project route. | 1 DELETE + 1 POST, no intervening project GET |
| F — external 404 | PASS. A second session deleted the loaded project; stale PUT returned 404, preserved/detached the draft to `/`, showed safe copy, and next Save POSTed. | 1 PUT 404 + 1 POST |
| G — OCC | PASS. Session A saved revision N+1; stale session B received 409 with its draft and URL intact. Confirmed reload/discard issued one GET and adopted the new clean snapshot at the same URL. | winner 1 PUT; stale 1 PUT 409; reload 1 GET |
| H — logout clean | PASS. URL and draft remained visible while logged out; login adopted the server snapshot. | logout 1 POST; login 1 POST + exactly 1 project GET |
| I — logout dirty | PASS. Route and draft remained; login reported local changes and did not hydrate; manual Save retained PUT behavior. | login 1 POST + 0 project GET; Save 1 PUT |
| J — session expiration | PASS. A secondary browser session had its cookie cleared; PUT returned 401 while route/draft/revision remained. Login did not hydrate the dirty draft and manual retry succeeded. | failed PUT 401; login 1 POST + 0 project GET; retry 1 PUT |
| K — races | TEST-ONLY. No artificial late-response instrumentation was used against staging. | covered by deterministic local route/workflow tests |

The optional OCC reload-404 variant was not repeated as a distinct flow; the
real two-session external-delete 404 path and the local OCC reload-404 test
cover the two boundaries separately.

## Request counts and StrictMode

Observed on staging:

- Open/hydration: 1 GET.
- Save New: 1 POST and 0 immediate GET.
- Save Existing: 1 PUT.
- Delete current: 1 DELETE.
- Delete then Save As New: 1 DELETE + 1 POST.
- Dirty reconnect: 0 project GET.
- Clean reconnect: 1 project GET.
- OCC reload: 1 project GET.
- Educational disclosure: 0 requests.

Fresh loads issued one `/api/v1/auth/me`; route hydration, adoption, and both
reconnect modes showed no StrictMode request duplication.

## Accessibility and titles

Real Chrome covered loading, loaded, invalid, unknown-route, retry/error,
dirty blocker, OCC, detached, and reconnect states. Loading announced
`Opening your project...`; route failures exposed an H1 and Retry button;
blocker and OCC moved focus to their H2; settled direct/Back/Forward/retry
hydration focused the workspace H1. Tab, Shift+Tab, Enter, and Space were used
across controls and educational disclosures. Both Enter and Space expanded
native disclosure controls without requests.

Titles observed:

- `/`, loading, error, invalid, and not-found: `SchemaWise`.
- Loaded project: `<Project name> — SchemaWise`.
- Back and Forward updated the loaded title correctly.

## Viewports and visual inspection

Chrome viewports 320x720, 360x800, 390x844, 768x1024, 1280x800, and 1440x900
all reported `scrollWidth == innerWidth`. Visual screenshots at 320px covered
the loaded workspace, project list, dirty blocker, OCC warning, detached
warning, and expanded educational results. No horizontal overflow, clipped
action, overlapping control, or reordered content was found.

## Axe

The deployed browser runner used axe-core 4.12.1 with color contrast enabled.
Root, loaded, loading, invalid, not-found, retry/error, blocker, OCC, detached,
and educational-result states each reported **0 violations**.

Exact inconclusive result:

- Route-only invalid/not-found/error states: 0 incomplete.
- Editor-bearing states: 1 `color-contrast` incomplete on the decorative,
  `aria-hidden` dependency-arrow glyph.
- Result-bearing OCC/detached/education states: 2 nodes under the same single
  `color-contrast` incomplete rule: the dependency arrow and the decorative,
  `aria-hidden` satisfied checkmark.

No rule was excluded. Axe could not compute contrast for those non-text glyphs;
this is not reported as a violation.

## Console and service monitoring

Across root, project, invalid, not-found, loading, error, blocker, OCC, and
detached sessions, browser console and page-error logs were empty: no React or
router warnings, unhandled promises, failed assets, refresh 404s, proxy errors,
CSP noise, or exposed secrets. Vercel reported no runtime error clusters during
the audit window. Render had no error-level logs in the audit window; its live
deployment remained healthy and unchanged.

## Issues, fixes, and deferred checks

No Critical, High, Medium, or Low v1.2 defect was found, so no code fix or
frontend-spec clarification was required. The axe contrast results above are
recorded exactly as inconclusive. Flow K late-response races and the distinct
OCC reload-404 variant remain covered by the frozen local test suite rather
than claimed as real staging observations.

Smoke projects were clearly named and deleted at the end of the audit. The
controlled staging user was not deleted. No user email was queried for audit
reporting, and Neon was not accessed manually.

## Validation and final result

- `npm run typecheck`: PASS.
- `npm test`: PASS, 41 files / 473 tests.
- `npm run build`: PASS; Vite transformed 77 modules.
- `npm run test --workspace @schemawise/web`: PASS, 16 files / 159 tests.
- `git diff --check`: PASS.
- `npm audit --omit=dev`: PASS, 0 vulnerabilities.
- Vercel deployment, Render health/readiness, SPA fallback, proxy regression,
  real browser flows A-J, request counts, accessibility, viewports, titles,
  axe, console, and smoke-data cleanup: PASS as recorded above.

**PROJECT RECOVERY V1.2 STAGING: PASS WITH DEFERRED CHECKS**

Next step: close v1.2 and decide the next feature. Do not deploy production.
