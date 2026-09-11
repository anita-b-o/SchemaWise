# Project routing and deep links v1.2

Status: design accepted; implementation pending.

This document defines the browser URL, navigation, route-loading, deployment,
accessibility, and test contracts for persisted projects. Recovery and
in-memory project-session semantics are defined in
[project-recovery-v1.2.md](./project-recovery-v1.2.md). Educational UX v1.1 is
frozen and remains unchanged.

## Baseline audit

The implemented frontend has no router. `main.tsx` renders `App`, `App` wraps a
single `SchemaWorkspace` in `AuthProvider`, and the wordmark is a plain link to
`/`. Consequently, refresh recreates the workspace even when `/auth/me`
recovers the session.

The current behavior is:

- New resets the reducer and `ProjectSession`; it is local and creates no
  server resource. Dirty New/Open actions use one inline discard confirmation.
- Save POSTs when there is no associated `projectId`; it PUTs the full name and
  schema with `expectedRevision=serverRevision` otherwise. It never analyzes.
- Open fetches a selected list item directly inside `SchemaWorkspace`, then
  `replaceDraft` installs the persisted schema and clears analysis, closure,
  synthesis, BCNF, and preservation state.
- Delete is confirmed and hard-deletes. Deleting the open project removes its
  association/revision/snapshot while keeping its name and schema as an unsaved
  draft.
- `AuthProvider` starts at `unknown`, calls `/auth/me` once (including under
  Strict Mode), and then becomes authenticated or unauthenticated. Login and
  registration update only auth memory. Logout and 401 preserve workspace
  memory; a failed logout leaves the authenticated state intact.
- A project session stores `projectId`, editable name, `serverRevision`, the
  saved name/schema snapshot, `savedDraftRevision`, and `syncUnavailable`.
  `savedDraftRevision` is recorded but dirty detection does not use it. The
  reducer's monotonically increasing `revision` is the draft revision used to
  mark computed resources stale and guard analysis snapshots.
- Dirty detection compares the current project name plus persisted schema to
  `savedSnapshot` structurally. Analysis and all derived results are excluded.
- A 409 keeps local edits and offers a separately confirmed server reload. A
  current-project 404 unlinks the project and preserves its draft so the next
  Save can POST.
- Project-list requests are fresh, limited to 20, and owned by the current
  session. Missing and foreign project IDs are indistinguishable as 404.

## Routing decision

Use React Router in Declarative mode with browser history. Use only route
matching, params, links/navigation, location, and the stable navigation-blocker
surface; do not introduce data loaders, actions, framework mode, a server cache,
or route-based analysis.

| Criterion | React Router | Minimal History API router | Wouter (small alternative) |
| --- | --- | --- | --- |
| Dependency | One established dependency | No dependency | Smaller dependency, another API to learn |
| Complexity | Route matching, history, params and blocking are composed | Matching, `popstate`, cancellation, cleanup and tests become local infrastructure | Matching is small, but product-owned blocking/recovery integration remains |
| Browser history | First-class push/replace and POP handling | Must be implemented and race-tested | Varies by library |
| Direct navigation | Natural with SPA fallback | Possible, but entirely custom | Generally possible |
| Testing | Memory-based routers and documented navigation APIs | Custom history harness | Library-specific history/mocking |
| Accessibility | Does not automate focus/title, but gives one transition boundary | Same duties plus custom routing | Same duties |
| Extensibility | Supports future routes without changing strategy | Cost rises with nested/error routes and blockers | May require migration later |

React Router wins because the hard part is not matching two paths; it is
coherent POP navigation, blocked transitions, route params, direct entry, and a
future-compatible route boundary. A custom History API solution would save one
dependency while making those behaviors application infrastructure. The
implementation must pin and verify the then-current stable React Router release.
The official stable `useBlocker` contract may be used for SPA navigation; no
`unstable_*` blocker API or private history workaround is allowed. Hard reloads
remain a separate `beforeunload` concern.

References: [React Router modes](https://reactrouter.com/start/modes),
[BrowserRouter](https://reactrouter.com/api/declarative-routers/BrowserRouter),
and [navigation blocking](https://reactrouter.com/how-to/navigation-blocking).

## Canonical routes

| URL | Meaning |
| --- | --- |
| `/` | A new local workspace, usable anonymously or while authenticated |
| `/projects/:projectId` | A reference to one persisted project owned by the authenticated user |

No `/login`, `/register`, `/settings`, `/projects`, `/dashboard`, `/share`, or
analysis routes are introduced. Open Projects remains an in-workspace panel.
Unknown paths use a technical accessible not-found boundary; that boundary is
not a product route.

The project UUID is an opaque locator, not authorization. The URL never
contains email, project/relation name, schema, revision, owner, or computed
result.

## Route semantics

Entering `/` without an intentional in-memory detached-draft handoff creates:

- project name `Untitled project`;
- empty relation, attributes, and dependencies;
- no loaded/persisted project identity;
- no server revision or saved snapshot; and
- all computed resources idle.

Entering `/projects/:projectId` never reads schema from the URL. It waits for
auth initialization, validates only the UUID v4 shape, and fetches the current
resource. A valid response atomically installs name, exact persisted schema,
project identity, persisted snapshot, and `serverRevision`; the state is
Saved. It does not call Analyze, Closure, synthesis, BCNF, or preservation.

Use a trivial case-insensitive UUID v4 shape check in the frontend. A malformed
value such as `/projects/foo` makes no project request and renders `Invalid
project link.` through the route error presentation. The API remains
authoritative and may still return `400 INVALID_PROJECT`; no other backend
validation rule is duplicated.

## Auth initialization and anonymous deep links

Route loading is gated by `AuthProvider`:

```text
auth unknown        -> waiting-for-auth; no GET
unauthenticated     -> waiting-for-auth; "Sign in to open this project."
authenticated       -> validate param, then load
```

The login/register panel is inline. It must not redirect to `/` or discard the
requested pathname. Successful authentication re-evaluates the same route and
attempts its GET. Before authentication, the UI does not claim whether the
project exists. Only the authenticated GET can produce not-found.

## Project hydration

Hydration has these explicit route-resource states:

| State | Contract |
| --- | --- |
| `idle` | `/`; no persisted route is being loaded |
| `waiting-for-auth` | Auth is unknown or unauthenticated; no project GET |
| `loading` | Authenticated GET for the current valid route ID is active |
| `loaded` | The current route ID and loaded project ID match |
| `not-found` | Authenticated GET returned the ownership-safe 404 |
| `error` | Invalid UUID, network failure, 400, or unexpected/server failure |

While loading, show a minimal editorial skeleton/status in place of the editor.
Do not show an empty draft, enable Save, or reuse analysis loading. Preserve the
URL. A 404 shows exactly `Project not found or unavailable.` A network/500
failure shows `Could not load project.` and `Retry`; Retry targets the current
route and does not navigate. A hydration 401 moves auth back to unauthenticated
and returns to `waiting-for-auth` without changing the URL.

If the route already has an in-memory loaded session (for example after logout),
the recovery rules in the companion document take precedence over blind route
hydration.

## Navigation contracts

### Open project

Selecting a project closes the panel and navigates to `/projects/${id}`. It
does not fetch or install a snapshot. The
route hydration coordinator is the only Open/refresh/reload loading path. If
dirty, the common route blocker confirms before the navigation commits.

### Save new

On `/`, a successful POST is the conversion of the current local draft into a
persisted resource. Adopt the returned revision/snapshot, then navigate to
`/projects/${id}` with `{ replace: true }`. Replace avoids Back exposing
a misleading empty version of the same just-saved draft. The trade-off is that
Back returns to the entry before that new workspace; opening an already saved
project continues to use push and therefore creates normal project history.

The transition is tagged as an already-hydrated persistence transition so it
does not GET the just-created project or reset the draft. Failed POST leaves `/`
and all local state unchanged.

### Save existing

On `/projects/:id`, PUT uses the loaded `serverRevision` as
`expectedRevision`. Success updates the revision and saved snapshot in place;
the URL and history do not change. Analyze never affects route or revision.

### New project

New requests `navigate('/')`. Clean navigation proceeds; dirty navigation uses
the common confirmation. Once committed, the route transition creates the
empty Untitled workspace and removes loaded ID, revision, snapshot, conflict,
and derived results. It must not merely mutate the old project session while
leaving the old URL.

### Delete and external delete

Successful deletion of the currently loaded project performs
`navigate('/', { replace: true })` while preserving name and schema as a
detached Unsaved draft. The same transition is used when Save receives 404.
It is a one-shot, in-memory handoff owned by the workspace route coordinator:
mark the pending transition as `detach-current`, commit the replace, consume
the marker by clearing persisted identity without resetting the draft, then
clear the marker. Do not put the draft in location/history state or
`localStorage`. Refresh after detachment therefore follows normal `/` semantics
and starts empty.

Deleting a project that is not open leaves the route and workspace unchanged.
The Open Projects panel closes after deleting the current project; otherwise it
remains usable with the removed row absent. A current-project 404 also displays
that the saved project no longer exists and the unchanged draft can be saved as
new.

## Dirty navigation and browser history

Dirty means only project name/schema differ from the saved snapshot, or a local
workspace contains persistable content/name changes. It excludes analysis and
presentation state.

One route-bound blocker covers Open, New, internal links, Back, and Forward
when the destination pathname differs. It presents the existing product-owned
`Discard unsaved changes?` UI. Cancel calls the blocker reset and keeps the
current route/draft; Proceed calls the blocker proceed exactly once. Save-new
replacement and delete-detachment are explicit transition intents and must not
accidentally trigger a second discard prompt.

Register `beforeunload` only while dirty, and remove it immediately when clean
or unmounted. The browser owns the generic reload/close text. Do not use it for
clean drafts or SPA navigation.

Normal push history behaves coherently:

```text
/ -> open A -> open B
Back: A
Back: /
```

If B is dirty, the first Back is blocked. Cancel stays at B. Proceed commits
the original POP to A and route hydration loads A. Forward can subsequently
return to B and hydrate it from the server. The design does not emulate POP
with manual `pushState` or maintain a shadow history stack.

## Refresh and local development

Refresh at `/projects/A` follows:

```text
serve index.html -> recover auth -> GET A -> replace workspace -> Saved
```

All computed state starts idle. No derived endpoint is called.

Vite 7's existing development server was verified locally on 2026-09-11:
requesting a direct `/projects/<uuid>` path returned `200 text/html` and the
Vite app entry. No custom development server or Vite configuration is needed.

## Vercel SPA fallback

The future implementation changes `apps/web/vercel.json` exactly to:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/api/v1/(.*)",
      "destination": "/api/proxy"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

The API rewrite must remain first and the SPA fallback last, so protected API
traffic continues through the reviewed Function proxy. Vercel gives filesystem
assets precedence; the fallback serves the application for direct client-side
paths. This tranche documents but does not apply the change. See Vercel's
[Vite SPA guidance](https://vercel.com/docs/frameworks/frontend/vite) and
[rewrite reference](https://vercel.com/docs/routing/rewrites).

## Accessibility and titles

- During loading, mark the route workspace busy and announce `Loading
  project…` in a polite status region. Errors/not-found have a semantic heading
  and alert/status treatment appropriate to persistence.
- After a committed route transition finishes, move focus to the workspace
  heading (`tabIndex=-1`); for loading failures, focus the error heading. Do not
  move focus on Save or background auth changes.
- Back/Forward uses the same heading and status behavior as link navigation.
  Visible focus, native controls, linear DOM order, and Educational UX v1.1
  remain unchanged.
- `/`, loading, waiting, invalid, and load errors use `SchemaWise`.
  Successfully loaded projects use `<Project name> — SchemaWise`. Relation
  name is never included. Update `document.title` only after the matching
  response commits, preventing stale responses from changing it.

## Planned tests

Component/integration tests will cover route `/`, valid and invalid project
paths; all auth gates and login continuation; hydration success, skeleton, 401,
404, network/500, Retry, and A-to-B races; Open/New/Save-new/Save-existing;
current and non-current Delete; external delete; Back/Forward; common dirty
confirmation, cancel/proceed, and conditional `beforeunload`; logout/expiration
with clean and dirty drafts; OCC reload; and regression of all derived-state
resets, auth, persistence, and frozen Educational UX.

Use an in-memory router for deterministic route histories and a real browser
router only where browser APIs (`beforeunload`, POP, title/focus) matter. API
clients remain injected. Tests must assert that auth unknown makes zero project
GETs, stale A cannot install over B, and hydration invokes no computational API.

The browser E2E sequence is:

1. Open anonymous `/` and register.
2. Create and save project A; assert URL becomes `/projects/A`.
3. Refresh; assert exact schema/revision-backed Saved state and no automatic
   analysis/result.
4. Create/open project B, then Back to A.
5. Edit A and exercise Cancel/Proceed on a navigation.
6. Produce an OCC conflict and explicitly reload the route project.
7. Logout on the project route; assert route and visible draft survive.
8. Login; verify clean automatic recovery and dirty non-overwrite in separate
   scenarios.
9. Delete the current project; assert preserved Unsaved draft and `/`.
10. In a new browser context, open a direct deep link anonymously, sign in,
    then verify success; repeat with unavailable ID for the generic 404.

## Out of scope

Project-list pagination/search, autosave, localStorage recovery, shared/public
projects, collaboration, URL-encoded schemas, persisted analysis, SSR,
production hardening, educational changes, new backend endpoints, and any new
product routes are excluded.
