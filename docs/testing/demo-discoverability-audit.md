# SchemaWise Demo Discoverability — Audit

Status: **DEMO DISCOVERABILITY: PASS**  
Date: 2026-10-11

## Problem and solution

The public Demo was available at `/demo`, but the normal workspace did not
surface a path to it. The primary application header now includes one semantic,
secondary `Try Demo` link to `/demo`. It is rendered independently of auth
state, so it is available to anonymous and authenticated workspace users.

Demo retains its existing temporary-workspace boundary and now labels its
existing return action `Open Workspace`, which links to `/`. The action remains
inside the Demo host so its existing dirty-state blocker and focus restoration
continue to apply.

No AuthProvider, project recovery, OCC, workspace-surface navigation, footer,
or API behavior changed. The Schema / Analysis / Transform navigation remains
separate from the new product-level link.

## Changes

- `apps/web/src/App.tsx`: semantic product navigation in the normal workspace
  header.
- `apps/web/src/features/demo/DemoWorkspaceHost.tsx`: clarified return label.
- `apps/web/src/styles.css`: compact header-link styling, including the 320 px
  layout.
- Route tests cover anonymous and authenticated discoverability plus both dirty
  transitions.

## Verification

- Automated: anonymous `/` exposes `Try Demo`; authenticated `/` exposes the
  same `/demo` link; `/demo` exposes `Open Workspace`.
- Automated: modified workspace → Demo is blocked until confirmation; modified
  Demo → workspace retains its existing confirmation; existing Demo history,
  refresh, focus, and request-isolation coverage passes.
- Real Chrome: inspected `/` at 320 px and 1440 px and `/demo` at 390 px. The
  product link is present in the first viewport, the layouts have no horizontal
  overflow, and the Demo return action is visible. Existing keyboard/focus
  coverage remains green in the route suites.
- Demo isolation: the strict-mode Demo route test confirms zero Auth and
  Project API calls while the Demo remains mounted.

## Gates

- `npm run typecheck` — pass
- `npm test` — pass
- `npm run build` — pass
- `npm run test --workspace @schemawise/web` — pass, 25 files / 239 tests
- `git diff --check` — pass
- `npm audit --omit=dev` — pass, 0 vulnerabilities

The test environment emits known jsdom canvas warnings from axe checks; they do
not fail the suites.

## Pre-release navigation stabilization — 2026-10-11

### Failure and diagnosis

The blocked release run failed in
`workspace-view-navigation.test.tsx` after activating `Analyze schema`: the DOM
was still on the Schema surface (`active-view="schema"`, Schema navigation with
`aria-current="page"`, and the heading `Define a relation and its
dependencies.`), so neither the Analysis heading nor `Explore
transformations` existed. The dump showed the loaded relation and no error.
It did not show evidence of a routing, composition, or product failure.

The production sequence is request start, Mathematical API response, reducer
success, navigation to Analysis, Analysis mount, and rendering of `Explore
transformations`. The affected test supplied an immediately resolving async
mock and then relied on `findByRole` to cross that whole boundary. Under
parallel host load, the continuation could remain behind unrelated scheduled
work. A controlled pending response reproduced the pre-navigation DOM with
exactly one analysis request, the loading state visible, the URL still `/`,
and the link absent; resolving that response produced the Analysis heading and
link. This identifies the unstable boundary without treating elapsed time as
the cause.

The earlier `a94fae9 test(web): stabilize transformation workflow navigation`
commit controlled the same request-to-result boundary in the core
transformation workflow. The blocked navigation test had not adopted that
pattern. A directed audit found the same demonstrated defect in the first two
analysis-results cases and the Enrollment transformation case; those cases
also stopped on Schema under heavy suite load. Other Analyze tests were not
changed without equivalent evidence.

The `Try Demo` product change is outside this sequence. Routing, dirty
blockers, Demo isolation, and Project Recovery behavior were unchanged. Mock
state remains scoped to each Vitest file and no cross-test mock leakage was
observed.

### Correction

The affected tests now own a deferred Mathematical API response, assert the
single expected request, resolve it with the captured request payload inside
React `act`, and then await the observable Analysis heading and transformation
link. The real reducer, routing, surface composition, and normalization
calculation continue to run. No sleeps, retries, timeout increases, skipped
tests, weakened assertions, API changes, engine changes, or production-code
changes were introduced.

### Repetitions and evidence

- Affected test: 15/15 post-fix passes; wall times 3.19–11.59 s (the first
  confirmation run was 3.36 s).
- Complete navigation file: 3/3 passes, 20/20 each; wall times 10.37 s,
  10.34 s, and 8.53 s.
- Directed final set (analysis results, transformation workflows, and
  navigation): 52/52, one worker, 23.55 s.
- Web suite: 3 successful final-state runs, 25 files / 239 tests each, in
  21.78 s, 88.39 s (serial), and 20.61 s (exact gate). An intervening serial
  attempt exposed an unrelated existing Project Recovery focus expectation
  under severe host contention; the content and title had already updated, the
  isolated test immediately passed in 3.93 s, and Recovery was left unchanged.

The workspace test count remains API 142, Web 239, engine 173: 554 total.
Schema → Analysis → Transform, one POST per Analyze, zero requests for surface
navigation, focus, `aria-current`, Back/Forward, dirty blockers, Demo
isolation, and Project Recovery remain covered.

### Final gates

- `npm run typecheck` — pass, 13.01 s
- `npm test` — pass, API 142 / Web 239 / engine 173, 554 total, 25.35 s
- `npm run build` — pass, 14.99 s
- `npm run test --workspace @schemawise/web` — pass, 25 files / 239 tests,
  20.61 s
- `npm audit --omit=dev` — pass, 0 vulnerabilities, 1.28 s
- `git diff --check` — pass

Because only tests and this appended audit record changed, the existing real
Chrome smoke at 320, 390, and 1440 px remains the product browser evidence.
The directed Demo route suite passed 16/16, and the Project workflow suite
passed 24/24. No publication, push, deploy, provider access, or secret access
was performed.

## Analysis Test Reliability Audit — 2026-10-11

### Scope and inventory

This audit covers the Schema → Analyze → Analysis → Transform boundary. The
web tests that activate Analyze or depend on the resulting Analysis navigation
are in `analysis-results.test.tsx`, `transformation-workflows.test.tsx`,
`workspace-view-navigation.test.tsx`, `demo-route.test.tsx`,
`project-workflows.test.tsx`, `closure-tool.test.tsx`,
`DelayedAsyncHint.test.tsx`, and `shared-workspace-core.test.tsx`.

- **A, controlled response:** the first two Analysis-result cases, the core
  keyboard transformation flow, and navigation's request/focus transition own
  a deferred mathematical response, observe one call, resolve it in `act`,
  and await a rendered heading.
- **B, immediate response:** the remaining happy-path Analysis, transform,
  Demo, Project, and closure scenarios use a resolved per-test mock only when
  their assertion is not the request-to-navigation hand-off.
- **C/D, loading or heading:** loading and abort cases assert `Analyzing…` or
  the status before settlement; result, stale-snapshot, navigation, and
  transform cases wait for the Analysis/result heading.
- **E, derived state:** stale-snapshot, historical-results, dirty blocker,
  transformation eligibility, `aria-current`, focus, Back/Forward, deep-link,
  and Demo-isolation cases assert reducer-derived observable state.
- **F, time:** no audited Analysis transition uses a sleep, retry, fake timer,
  or an increased timeout as synchronization. `DelayedAsyncHint` alone owns
  fake-clock behavior for its separate delayed-hint contract.

### Lifecycle and async contract

`WorkspaceSurfaces` binds the real Analyze interaction to
`useSharedWorkspaceCore.analyze`. That hook captures the current draft and
revision, creates an `AbortController` and request id, then dispatches
`analysisRequestStart`. The mathematical API promise is the first real async
boundary. A matching active controller dispatches `analysisSuccess`; the
reducer accepts only the matching request id, installs the captured snapshot,
and calculates `outOfDate` against the current draft revision. Only after that
dispatch does `onAnalyzeSuccess` navigate through the host's workspace-view
provider. The Analysis surface then mounts, the host focus effect targets its
heading, and `AnalysisResults` renders from `inputSnapshot`, not the mutable
draft. Navigation, React commit/effects, and focus are the remaining async
boundaries. `ProjectWorkspaceHost` and `DemoWorkspaceHost` use the same core;
Demo adds only its local dirty-navigation blocker.

### Evidence, cause, and correction

The requested Customer test did not fail during isolated reproduction (20/20
passes before the edit), so no failing DOM dump is claimed. Historical audit
evidence in this document recorded the same Schema-surface DOM before the
response-to-navigation continuation completed: Schema was current,
`Define a relation and its dependencies.` was present, and the Analysis
heading/link were absent. The Customer test was the remaining relevant case
with an immediate async mock and no explicit request settlement boundary.

It now uses the established controlled-response contract: mount; interact;
assert exactly one `analyzeSchema` call; resolve the captured input response
inside `act`; await `R(Customer, B, C)`; then assert the edit, stale notice,
historical Customer labels, and absence of Client labels. This does not bypass
the reducer, navigation, or rendering. It removes the demonstrated scheduling
assumption without changing production behavior. No shared helper was added:
the four local lines match the existing file idiom and a generic utility would
not reduce enough duplication to justify another abstraction.

There is no evidence of a reducer request-id race, incorrect stale condition,
aborted valid request, shared mock leakage, fake-timer interaction, or
StrictMode product defect. The directed navigation coverage exercises the
transition under `StrictMode`; its deferred request/focus/`aria-current` path
passed unchanged.

### Stability and remaining work

- Customer test: 20/20 sequential passes after the correction; individual
  runs ranged from 2.59 s to 4.05 s.
- `analysis-results.test.tsx`: 5/5 sequential passes, 13 tests each, 3.85–4.23 s.
- Related Analysis/Transform/navigation set: 3/3 passes, 52 tests each,
  7.50 s, 8.03 s, and 10.49 s.
- Web suite: 5 successful normal-worker runs, 25 files / 239 tests each,
  13.36–16.29 s. One earlier full-suite attempt terminated with a truncated
  failure report; it was immediately rerun verbosely (239/239) and followed by
  three more successful normal-worker runs. No repeatable failure or related
  Analysis defect was observed. The expected jsdom canvas warnings from axe
  checks remain non-failing.

Final gates passed: `npm run typecheck` (8.5 s), `npm run build` (12.6 s),
`npm run test --workspace @schemawise/web` (included in the five Web runs),
`npm test` twice sequentially (API 142 + Web 239 + engine 173 = 554 each),
`git diff --check`, and `npm audit --omit=dev` (0 runtime vulnerabilities).
Only `analysis-results.test.tsx` changed in code. Browser smoke is not needed
because production code did not change. No push or deploy is authorized.
