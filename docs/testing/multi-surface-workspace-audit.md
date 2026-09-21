# Multi-Surface Workspace — Tranche 4 release audit

Date: 2026-09-21. Scope: local hardening of Schema → Analysis → Transform.
No push or deployment was performed. The local release classification is
**FROZEN**, subject to the external checks listed below.

## Source and architecture

`origin/master...HEAD` at the start of Tranche 4 contained 9 unpushed commits
and 31 changed files. They were limited to web navigation/components/styles,
web tests, and frontend documentation. There was no engine, API contract,
migration, infrastructure, or secret change; no analysis persistence or second
workspace store was introduced. Tranche 4 adds two focused web fixes and their
tests/docs. The single mounted `SchemaWorkspace` owns draft, project session,
analysis snapshot, Closure, and transformation resources. `?view=` selects one
rendered surface. Unknown values select Schema. `ProjectRoute` owns hydration;
the navigation coordinator guards resource changes, not surface changes.

## Route and surface evidence

| Route | Local browser result |
| --- | --- |
| `/`, `?view=schema`, `?view=foo` | Schema; one surface h1; no calculation on entry |
| `/?view=analysis`, `/?view=transform` | Explicit empty state; no redirect or calculation |
| `/projects/A` | Auth recovery and one project GET; Schema |
| `/projects/A?view=analysis`, `/projects/A?view=transform` | Requested surface after one project GET; derived results idle |
| `/projects/foo?view=analysis` | Invalid project link; no project GET |
| `/foo` | Page not found; global shell and footer remain |

Direct project view refresh was exercised through the Vite SPA fallback and an
in-memory HTTP auth/project harness, with the real stateless computation routes
from `createServer`. The configured Vercel SPA rewrite is covered by existing
routing tests. Hosted Vercel refresh remains an external check.

Schema rendered intro, decorative birds, relation/attribute/FD editing, Load
example, Analyze, and disclosed Closure. It did not render analysis or
transformation results. Analysis rendered the immutable snapshot, candidate
keys, prime attributes, normal forms, minimal cover, Issues, Explain, formal
reasoning, visualization, Edit schema, and Explore transformations. It did not
render the editor or transformation composition. Transform rendered 3NF, BCNF,
preservation, neutral comparison, diagrams, and disclosed reasoning. It did
not render the editor, full Analysis, or birds. A one-attribute BCNF-satisfied
schema offered no unnecessary Generate controls and explained the idle path.

## Calculations, history, and stale snapshots

The real local API returned one Analysis POST for Analyze and one POST for each
3NF, BCNF, preservation, and Closure action. Loading and a controlled 500 error
stayed on Schema; the error had an alert, the draft stayed intact, and the
previous analysis remained accessible. Success pushed Analysis and focused its
h1. Explicit surface links focused the destination h1; Back/Forward restored
surfaces without calculation or forced focus. Surface links, Explain, and
diagram actions produced no mathematical request. Closure remained in reducer
state across Schema → Analysis → Transform → Schema without recomputation.

Editing an attribute after Analyze marked Analysis and Transform out of date.
The summary, Issues, minimal cover, Explain, formal reasoning, and both Analysis
diagram modes used historical names. Stale Transform without results exposed no
generation controls. With results, all three resources remained visible and
new operations were disabled. A successful reanalysis returned Current and
reset the old transformation resources.

The six-attribute Enrollment fixture used stable attribute IDs `d,c,a,b,e,f`
and the five requested FDs. Browser Analysis returned candidate key
`{Student, Course}`, the same prime attributes, 3/44/44 violation counts, and
8 → 44 → 8 visible Issues. The real API returned four expected 3NF relations,
four expected BCNF relations, three BCNF steps, lossless join, and a failed
preservation check with `Department → Office` lost. The simple `R(A,B,C)` flow
completed all three surfaces. BCNF decomposition is not unique: a separate
valid fixture with different technical IDs produced different BCNF leaves; the
stable fixture verified the expected deterministic output.

## Project recovery and persistence

The browser harness exercised Save New from Schema, Analysis, and Transform:
one POST, route adoption with `replace`, no immediate GET, preserved view, and
preserved in-memory Analysis/Transform result. Save Existing made one PUT,
kept URL/view/history length, and incremented the server revision. Open B from
Transform A selected B's Schema. New from Analysis selected root Schema.
Dirty surface navigation did not prompt; resource changes did. A 120-character
name stayed accessible in the input and clipped only its context display at
320 px without page overflow.

Deleting the current project returned to root Schema with a detached draft.
External deletion followed by PUT 404 did the same without stale project
identity. A 409 conflict retained draft, URL, view, and known revision; a
confirmed reload fetched once, preserved Analysis view, and showed its empty
state because analysis is not persisted. Dirty logout/login retained the draft
and view with no automatic project GET, and the subsequent Save used the known
revision. Clean logout/login made one reconnect GET. Existing route tests cover
session-expiration 401, reload 404, late A response after B navigation, and
same-resource view changes during hydration. The local browser harness did not
inject those final race variants.

## Responsive and accessibility

| Viewport | Schema height | Analysis height | full simple Transform height | Horizontal overflow |
| --- | ---: | ---: | ---: | --- |
| 320×720 | 3162 | 2078 | 2861 | none |
| 390×844 | 3050 | 2078 | 2780 | none |
| 768×1024 | 2424 | 1606 | 2132 | none |
| 1024×768 | 2419 | 1600 | 2120 | none |
| 1280×800 | 2463 | 1636 | 2062 | none |
| 1440×900 | 2463 | 1636 | 2062 | none |
| 1920×1080 | 2463 | 1636 | 2062 | none |

Heights are one local browser content state, not performance targets. The full
Enrollment Transform measured 3426 px at 320; collapsed Analysis 3766 px;
expanded 44-Issue Analysis 11045 px. Disclosures and decomposition steps were
closed by default. The comparison, diagrams, navigation, context, controls,
buttons, and footer remained within the viewport. A screenshot and DOM bounds
confirmed that the long project title was truncated in context while its full
120 characters remained in the labelled input.

Chrome axe-core 4.13 reported **zero violations** in Schema empty/populated,
Analysis empty/current/stale, 44 Issues collapsed/expanded, Transform
empty/current/full/stale, satisfied BCNF, and mobile 320/390 surface states.
`color-contrast` was **incomplete** on some Schema and simple Analysis states;
it was not recorded as a pass. The full Enrollment result had zero incomplete
checks at 320. DOM/accessibility-tree inspection found the Workspace nav name,
one active `aria-current`, one surface h1, labelled project controls, status
regions, native disclosures, semantic math names, and labelled diagrams.
Chrome DevTools captured zero warning/error/exception entries during a fresh
Schema → Analyze → Transform flow. No obvious request loop, blocked rendering,
or large layout shift was observed. Native controls and focused component tests
cover Tab, Shift+Tab, Enter, Space, and focus transitions; attended screen
reader and physical-device keyboard sessions remain external checks.

## Fixes and quality gates

1. Analysis's Schema diagram mode read the live draft and mixed renamed
   attributes with historical results. It now reads the analyzed snapshot and
   has a stale-snapshot regression test.
2. Save New reapplied its adopted project schema and cleared in-memory results.
   A one-shot adoption guard retains the mounted resources; focused tests and
   browser checks verify node identity on Analysis and Transform.
3. One Enrollment test timed out only while test/build/audit commands competed
   for local CPU. Its existing async heading wait was raised to three seconds;
   isolated and full reruns passed. No product failure reproduced.

The dead parallel Input/Results grid, sticky editor scroll, old transformation
composition, and transitional test harness are absent from product source.
The long historical design sections in `workspace-flow-redesign.md` remain as
decision records, not live implementation guidance. The new tests assert
observable state and resource identity rather than pixels. The slowest focused
test cases stayed below five seconds in the final web run.

Final gates: `npm run typecheck`, `npm test`, `npm run build`,
`npm run test --workspace @schemawise/web`, `git diff --check`, and
`npm audit --omit=dev` passed. Total **534 tests**: API 142, Web 219,
normalization engine 173. Runtime audit: **0 vulnerabilities**.

## Deferred external checks

- Hosted Vercel deep-link refresh and public-demo smoke after push/CI/deploy.
- Live database, real authentication persistence, and race timing against the
  deployed service; the local harness is not evidence for those systems.
- Physical 320/390 devices and an attended screen reader session.
- Manual review of axe's `color-contrast` incomplete nodes in the deployed
  rendering environment.

These checks are deferred, not marked PASS. No Critical, High, or Medium local
defect remains after the two fixes. Push all local commits, allow CI and Vercel
auto-deploy, then run the public-demo browser smoke. No Render redeploy is
indicated by this frontend-only diff; no Neon change or commercial production
promotion is part of this tranche.
