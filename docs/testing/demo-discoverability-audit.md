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
