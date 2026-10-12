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
