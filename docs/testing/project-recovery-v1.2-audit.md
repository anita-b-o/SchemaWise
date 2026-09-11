# Project Recovery + Deep Links v1.2 local audit

Date: 2026-09-11  
Classification: **PROJECT RECOVERY V1.2: FROZEN**  
Scope: local production Vite build, deterministic same-origin mock HTTP API,
real Chromium via ephemeral `agent-browser`, configuration/unit/integration
tests, and documentation. No production, staging deployment, backend, secret,
or Neon mutation was performed.

## Routing and deployment fallback

`apps/web/vercel.json` uses Vercel's current documented Vite SPA form and exact
order:

1. `/api/v1/(.*) -> /api/proxy`
2. `/(.*) -> /index.html`

Configuration assertions prove POST analysis, GET auth/me, and GET projects
select the Function rule before the catch-all. Proxy-core coverage proves a
direct `/api/proxy` request returns 404 without calling upstream. Direct valid,
invalid, and unknown frontend paths served the built `index.html`; React Router
then rendered the project route, `Invalid project link.`, or `Page not found.`
respectively. The invalid UUID made no project GET.

## Browser flows A–K

| Flow | Result | Exact relevant requests |
| --- | --- | --- |
| A — create/refresh | PASS: registered, saved A, adopted route with no GET; refresh restored exact schema as Saved with derived resources idle | create: 1 POST; refresh: 1 auth GET + 1 project GET |
| B — open/back/forward | PASS: A/B/A/B identity, title, history, and fresh hydration coherent | 1 GET per committed project route |
| C — dirty blocking | PASS: first Back + Stay retained dirty B; second Back + Discard loaded A | 0 GET while blocked; 1 GET after discard |
| D — save-new adoption | PASS: root POST replaced route and did not flash/load; refresh hydrated once | 1 POST, 0 immediate GET; refresh 1 GET |
| E — delete current | PASS: DELETE moved to `/`, preserved draft as Unsaved, and next Save created a resource | 1 DELETE then 1 POST; 0 intervening GET |
| F — external delete | PASS: PUT 404 detached to `/`, preserved draft/message, next Save POSTed | 1 PUT then 1 POST |
| G — OCC | PASS: PUT 409 retained draft/route; confirmed reload GET adopted server snapshot clean; reload 404 detached while preserving draft | 1 PUT + 1 GET in each reload scenario |
| H — logout clean | PASS: route/draft remained offline; login adopted server snapshot | logout/login plus exactly 1 reconnect GET |
| I — logout dirty | PASS: dirty attached draft survived; login did not hydrate; Save retained PUT/revision behavior | 0 reconnect GET; next Save 1 PUT |
| J — session expiration | PASS: PUT 401 preserved route/draft/revision; login did not hydrate; retry PUT succeeded | failed PUT + 0 reconnect GET + retry PUT |
| K — races | PASS: late initial A, late OCC reload A, and late reconnect A could not overwrite B or `/`, title, or focus | expected initiated GETs only; stale completions inert |

No flow invoked analysis, closure, synthesis, BCNF decomposition, or dependency
preservation. Educational disclosures emitted zero requests.

## Request-count and StrictMode audit

- Open: 1 GET.
- Save New: 1 POST and 0 immediate GET.
- Save Existing: 1 PUT.
- Delete current: 1 DELETE.
- Delete then Save As New: 1 DELETE + 1 POST.
- Dirty reconnect: 0 GET.
- Clean reconnect: 1 GET.
- OCC reload: 1 GET.
- Educational disclosure: 0 requests.

StrictMode remained enabled. Automated strict tests and browser request logs
confirmed one `/auth/me`, one route hydration GET, no adoption GET, and one
clean reconnect GET. Dirty reconnect remained zero.

## Accessibility, keyboard, titles, and console

Loading uses a polite status; invalid/not-found/error states use an accessible
heading, Retry is a native button, the blocker and destructive confirmations
are announced, detached errors use an alert, auth reconnect uses status, and
OCC moves focus to its conflict heading. Async route errors focus their heading,
and successful direct/Open/Back/Forward/Retry hydration leaves focus on the
workspace H1 with `tabindex=-1` after the settled render.

Native buttons, inputs, checkbox groups, and disclosures were exercised with
Tab, Shift+Tab, Enter, and Space. Browser Back/Forward was exercised separately
from SPA controls. No duplicate live-region content was found in the
accessibility tree.

Titles were `SchemaWise` for `/`, loading, invalid, unavailable, error, and
unknown routes; loaded projects were `<name> — SchemaWise`. Back/Forward updated
the title. Every stale race retained the current title.

Normal UI navigation produced no React, duplicate-key, router, unhandled
promise, asset, refresh-404, or proxy warning. Router warnings seen only while
deliberately using the audit tool's raw `pushState` race primitive were harness-
induced and absent from browser-control/UI navigation.

## Viewports

Audited production UI at 320x720, 360x800, 390x844, 768x1024, 1280x800, and
1440x900. Root, loaded project, project list, blocker, detached warning, and OCC
surfaces had `scrollWidth <= innerWidth`; no horizontal overflow was present.
The educational editor/results order and content remained intact.

## Axe 4.13.0

Real-browser axe runs covered `/`, loaded project, loading, unavailable, error,
dirty blocker, detached state, and OCC state. Result: **0 violations** in every
state. Axe reported `color-contrast` as inconclusive on the decorative,
`aria-hidden` dependency arrow in editor-bearing states because it contains
only a non-text glyph; no contrast rule was excluded, and visual inspection at
mobile/desktop sizes found the glyph legible and non-informational. Route-only
unavailable/error states had zero incomplete checks.

## Issues and fixes

1. Medium: Vercel lacked the SPA catch-all. Fixed with the ordered official
   rewrite and locked by configuration assertions.
2. Medium: real Chromium lost workspace-heading focus after hydration because
   the focus prop existed for only a transitional render. Fixed by carrying an
   explicit focus intent through committed hydration state; adoption,
   reconnect, and OCC reload keep their distinct behavior.
3. Medium: async project 404/error headings were not focused. Fixed with scoped
   failure-heading focus.
4. Low: axe found `aria-labelledby` on the dependency-composer `div` lacked a
   supported semantic role. Fixed by making it a labelled `group`.

No Critical, High, Medium, or Low defects remain open. The only deferred item
is real staging deployment/audit, not a known product defect.

## Validation record

- `npm run typecheck`: PASS, 3 workspaces.
- `npm test`: PASS, 41 files / 473 tests (API 10/140, Web 16/159, Engine 15/174).
- `npm run build`: PASS, all workspaces; Vite transformed 77 modules.
- `npm run test --workspace @schemawise/web`: PASS, 16 files / 159 tests.
- `git diff --check`: PASS.
- `npm audit --omit=dev`: PASS, 0 vulnerabilities.

## Staging plan and final gate

The diff is Web/config/docs only. Vercel requires a staging deployment because
`vercel.json` and the frontend bundle changed. Render requires no redeploy;
Neon requires no schema or data action. After Vercel staging deployment, repeat
the direct-refresh, proxy, flows A–K, console, axe, title/focus, keyboard, and
viewport checks against real staging before any production decision.
