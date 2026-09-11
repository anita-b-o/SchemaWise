# Project recovery v1.2

Status: design accepted; Tranche 1 route recovery implemented.

Tranche 1 implements first-entry authenticated hydration, exact persisted
snapshot/revision recovery, derived-result reset, and the three-part race guard
(abort, request ID, and route ID). Dirty-session login recovery, detachment,
external-delete recovery, and navigation blocking remain intentionally pending
for Tranche 2.

This document defines how a routed project, a mutable local draft, and its last
known persisted snapshot coexist. Routing and deployment contracts live in
[project-routing-v1.2.md](./project-routing-v1.2.md).

## Product invariant

A successful `/projects/:projectId` hydration restores exactly the persisted
name/schema and server revision, begins Saved, and clears every derived result.
It never analyzes. URL identity does not prove that a server snapshot is loaded,
does not grant ownership, and does not authorize overwriting local work.

## State ownership

Keep the existing boundary: auth state in `AuthProvider`, mutable schema and
computed resources in the workspace reducer, and a small project-session model
at the routed workspace boundary. Do not add a global store or cache.

Conceptually:

```ts
type HydrationState =
  | { status: "idle" }
  | { status: "waiting-for-auth" }
  | { status: "loading"; projectId: string; requestId: string }
  | { status: "loaded"; projectId: string }
  | { status: "not-found"; projectId: string }
  | { status: "error"; projectId: string; kind: "invalid-id" | "network" | "server" };

type ProjectSession = {
  loadedProjectId?: string;
  name: string;
  serverRevision?: number;
  persistedSnapshot?: ProjectSnapshot;
  syncAvailability: "available" | "authentication-required";
  hydration: HydrationState;
};
```

`routeProjectId` is derived from the current router match and passed to the
coordinator; it should not be copied into mutable session state. This makes URL
identity authoritative and avoids two route IDs drifting apart.
`loadedProjectId` means the visible draft was hydrated from (or just created as)
that resource. It is present only with its `serverRevision` and
`persistedSnapshot`. A non-empty draft with no loaded ID is detached and will
POST on Save.

The workspace reducer's `revision` remains the local draft revision for
analysis/closure staleness. It is not OCC state. `serverRevision` remains the
only `expectedRevision`. `savedDraftRevision` can be removed from the project
session because current dirty semantics correctly compare persisted fields to
the immutable persisted snapshot; a revision counter cannot detect edit-then-
revert cleanliness.

`syncAvailability` states whether authenticated project operations can be
attempted, not whether the draft is clean. Hydration and analysis request state
remain independent.

## Atomic hydration

For a valid authenticated route, start one request scoped by route ID and
request ID. Commit only if all are true:

1. the request is still the active hydration request;
2. the current route param still equals the requested project ID; and
3. the response project ID equals that ID.

On commit, one coordinated transition:

- dispatches `replaceDraft(persistedSchemaToDraft(project.schema))`;
- installs project name, ID, revision, and the exact returned persisted
  snapshot;
- makes sync available and hydration loaded;
- clears persistence errors/conflict UI and closes Open Projects; and
- updates title/focus after the matching state renders.

`replaceDraft` intentionally recreates analysis, closure, synthesis, BCNF,
preservation, and their request records as idle. Active computation controllers
must also be aborted on a committed project transition; their request IDs then
cannot mutate the reset state. Hydration does not call a computation endpoint.

While hydration is waiting/loading/not-found/error, no empty editable draft is
shown and Save is disabled. Retry is route-scoped.

## Save and stale state

For a loaded project, Save PUTs the complete current name/schema with the last
`serverRevision`. A successful response replaces revision and persisted
snapshot but does not navigate or reset analysis. Therefore:

```text
hydrate project N -> Saved
edit persisted field -> Unsaved
Analyze -> still Unsaved
Save -> Saved at revision N+1
```

For a detached `/` draft, Save POSTs and the already-hydrated replace transition
described in the routing document adopts the response without a redundant GET.

## Logout and session expiration

Logout while `/projects/A` is loaded does not navigate, clear project identity,
or reset the workspace. It sets sync availability to
`authentication-required`; the route, draft, persisted snapshot, revision, and
derived results stay in memory and the project bar says `Sign in to save`.

A 401 during Save or another protected project operation has the same result:
mark auth unauthenticated, preserve all local/project state, show the sign-in
requirement, and do not retry the mutation automatically. A failed network
logout retains authenticated state, matching v1.

After successful login on a retained project route:

- If `loadedProjectId` matches the route and the local persisted fields still
  equal `persistedSnapshot`, GET A automatically. It is safe to refresh a clean
  draft and obtain the newest revision/snapshot.
- If that session is dirty, do not GET and do not overwrite it. Restore sync
  availability, retain its last revision/snapshot, and show that local changes
  were preserved. The user may Save (and OCC may reject it) or choose `Reload
  saved version`, which uses the existing destructive confirmation before GET.
- If no project has ever been loaded in memory (anonymous direct link), login
  starts normal route hydration.

This rule is deliberately based on snapshot comparison, not on whether logout
was explicit. It also safely handles login as a different account: ownership is
rechecked by the next GET/PUT, foreign and absent IDs remain the same 404, and a
dirty draft is never sent or replaced without the user's Save/reload action.

If automatic clean revalidation returns 404 for a previously loaded session,
use the external-delete detachment flow: replace to `/`, preserve the visible
draft, and say that the saved project is no longer available. If a first-time
deep-link hydration returns 404, keep its URL and show the generic not-found
state because there is no draft to recover.

## OCC

OCC is unchanged. A 409 never retries and never changes URL, draft, saved
snapshot, or revision. It shows `This project was updated elsewhere.` with
`Reload saved version` and Cancel. Reload requires the existing second
confirmation, then GETs the current `routeProjectId` through the same hydration
coordinator. A matching success atomically replaces the draft and revision;
Cancel keeps local edits. There is no force overwrite.

The route ID, not a stale captured session ID, is the reload target. If the
route changes before confirmation, dismiss the old conflict state.

## Delete and detached drafts

Deleting the loaded route project is the only successful mutation that
intentionally converts an attached draft to detached without resetting its
content. After DELETE:

1. retain current name and schema;
2. clear loaded ID, revision, persisted snapshot, conflict, and hydration
   association;
3. reset derived results only if existing v1 product behavior later requires
   it (v1 currently preserves visible content; v1.2 does not make analysis part
   of persistence identity);
4. replace the URL with `/` through the one-shot in-memory detachment intent;
5. display Unsaved and the recovery explanation.

No draft is serialized into URL, Web Storage, or history state. Browser refresh
after this transition starts a normal empty `/` workspace.

If PUT Save returns 404 because another session deleted the project, perform
the identical detach/replace transition. The message is `This saved project is
no longer available. Your local draft is unchanged and can be saved as a new
project.` The next Save POSTs. A 404 from an explicit OCC reload of a dirty
loaded project also detaches and preserves the draft rather than hiding it
behind a first-entry not-found screen.

## Race safety

Route hydration uses all three inexpensive protections:

- an `AbortController`, aborted on route/auth change, retry, unmount, or newer
  hydration;
- a unique request ID checked before every completion; and
- current-route and response-ID comparison before commit.

`ProjectApi.getProject` will accept an optional `AbortSignal` in implementation;
this is a frontend adapter change only. Aborts are silent. Even when a transport
cannot be cancelled, request/route checks make its response inert.

Example: A starts, navigation to B commits, A is aborted, B starts, and a late A
response fails both the request-ID and current-param checks. It cannot replace
B's draft, revision, status, title, errors, or focus.

The same route coordinator must be used by direct entry, Open Projects, Retry,
clean post-login recovery, and OCC reload. There must not be separate
`openFromPanel` and `loadFromRoute` implementations.

## Error resolution matrix

| Condition | Route | Draft/session | UX |
| --- | --- | --- | --- |
| Auth unknown | unchanged | do not initialize from an empty placeholder | Loading/checking session status |
| Anonymous deep link | unchanged | no ownership probe | `Sign in to open this project.` |
| Hydration 401 | unchanged | retain any in-memory state | Sign-in requirement |
| First-entry 404 | unchanged | no loaded session | `Project not found or unavailable.` |
| Hydration network/500 | unchanged | no false empty draft | `Could not load project.` + Retry |
| 409 Save | unchanged | preserve attached dirty draft and old revision | Existing OCC panel |
| 404 Save/reload of loaded draft | replace `/` | detach and preserve | Remote unavailable; Save As New |
| Invalid UUID | unchanged | no GET | `Invalid project link.` |

Server 404 is intentionally identical for absent and foreign projects. The
frontend never probes or labels ownership.

## Implementation boundaries

The routing shell/coordinator owns params, hydration, transition intent, focus,
and title. `SchemaWorkspace` continues to own the draft, analysis resources,
project actions, and panels, but receives navigation semantics rather than
calling a second project loader. `AuthProvider` remains limited to user, CSRF,
and auth status; it does not cache projects or return URLs.

Avoid a large state machine library. The discriminated hydration resource plus
existing reducer/session state is sufficient, provided invariants are enforced:
loaded ID/revision/snapshot appear together; a loaded ID must match the current
project route; and a response can commit only for the active route request.

## Risks and trade-offs

- React Router adds dependency/upgrade surface, but removes bespoke POP and
  blocker infrastructure. Pinning a stable release and testing browser history
  contains the risk.
- Keeping a dirty draft attached after re-login may lead to an OCC conflict;
  this is preferable to silent data loss and the existing explicit reload UX
  resolves it.
- A clean draft may update after login because automatic GET is explicitly safe
  only when it equals the last snapshot. A disappeared project detaches instead
  of destroying the visible copy.
- `beforeunload` copy and some mobile behavior are browser-controlled. It is a
  last-resort loss warning, not the in-app confirmation UI.
- The detached-draft handoff is intentionally tab-memory-only. A later refresh
  loses it, consistent with `/` and the explicit exclusion of local recovery.
- A catch-all Vercel fallback makes client routes deployable but must remain
  after the API proxy rewrite; staging smoke must prove both paths.

## Recommended implementation tranches

1. Add the stable declarative router, canonical routes, UUID validation,
   auth-gated route hydration with race safety, loading/error/not-found views,
   title/focus behavior, and focused routing/hydration tests. Do not change
   Save/Open/New/Delete behavior in this tranche.
2. Route all Open/New/Save-new navigation through the coordinator and add the
   unified dirty blocker plus conditional `beforeunload`.
3. Add delete/external-delete detached handoff, logout/expiry safe reconnection,
   and OCC route reload; complete integration regressions.
4. Apply and verify Vercel fallback, then execute the real browser E2E and
   staging smoke plan without changing Educational UX.
