# ADR 017: Project deep links and recovery

Status: **Accepted**

## Context

SchemaWise v1 recovers authentication after refresh but has only `/`, so the
in-memory workspace and open-project association are lost. Persisted projects
need stable private deep links without serializing schemas or changing the
backend ownership/OCC contract. Navigation must also protect dirty drafts across
links and browser Back/Forward.

## Decision

Adopt React Router in Declarative browser-history mode. The only product routes
in v1.2 are `/` for a new local workspace and `/projects/:projectId` for a
persisted-project reference. Open Projects remains a panel. Use the stable
navigation blocker API after verifying the pinned release; do not use unstable
APIs, custom `popstate` recovery, data-router loaders, or framework mode.

The route parameter is the canonical URL identity. It is distinct from the
loaded project identity, mutable local draft, last persisted snapshot,
`serverRevision`, and sync availability. URL presence alone never means a
project is loaded or owned.

On direct project entry, wait until `/auth/me` resolves. Anonymous users see a
sign-in requirement without losing the URL. Authenticated users with a valid
UUID v4 route hydrate through one route coordinator. Success installs the exact
server snapshot/revision as Saved and resets all derived resources without
running analysis. Missing and foreign resources share one not-found state.
Invalid UUIDs are rejected locally only by trivial format validation.

Use the existing snapshot comparison as dirty authority. One blocker covers
all in-app pathname changes, including Back/Forward; a conditional
`beforeunload` covers hard reload/close. Save-new replaces `/` with its returned
project URL. Open/New use push navigation. Delete or externally missing current
projects replace to `/` through a one-shot in-memory transition that preserves
the draft but clears persisted identity; no Web Storage or history payload is
used.

Logout/401 retains route, draft, loaded identity, snapshot, and revision while
marking sync unavailable. After login, a retained clean draft may be rehydrated;
a dirty one must never be fetched over automatically. The user can Save under
OCC or explicitly confirm reload.

Hydration is guarded by abort signal, request ID, and current-route comparison.
Open, direct entry, Retry, OCC reload, and safe login recovery all use this one
path.

Vercel will keep `/api/v1/(.*) -> /api/proxy` first and add
`/(.*) -> /index.html` last. Vite development already supplies SPA fallback;
no custom server is introduced.

## Consequences

- A stable project URL restores server state after refresh and preserves normal
  browser navigation.
- React Router becomes a frontend dependency and its pinned blocker behavior is
  a release gate.
- Refresh restores only persisted input, never derived calculations or an
  unsaved local draft.
- Dirty data is not silently overwritten after auth transitions, at the cost of
  an explicit recovery choice and possible OCC conflict.
- Save-new replace treats `/` and the created project as one logical history
  entry; Back does not reveal a false empty predecessor.
- Deployment must smoke-test both direct project paths and the existing Function
  proxy because rewrite ordering is security-critical.

Detailed UX, state, errors, tests, and rollout are normative in
[project-routing-v1.2.md](../frontend/project-routing-v1.2.md) and
[project-recovery-v1.2.md](../frontend/project-recovery-v1.2.md).
