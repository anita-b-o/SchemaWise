# Frontend auth and project UX v1

Status: implemented.

> Project deep links and safe refresh recovery are accepted for v1.2 but not
> implemented. See [project-routing-v1.2.md](./project-routing-v1.2.md) and
> [project-recovery-v1.2.md](./project-recovery-v1.2.md). Those documents extend
> this baseline without changing the implemented v1 behavior described here.

SchemaWise remains an anonymous-first computational workspace. Authentication
appears only when the user chooses Sign in, Save, or Open projects; successful
registration and login never replace the current draft. The session cookie is
HttpOnly and every frontend auth request uses `credentials: "include"`.
`user` and the session-bound CSRF token exist only in React memory.

The project bar is a thin persistence layer around the workspace. Project name
is independent from relation name and defaults to `Untitled project`. New does
not create a server record. The first manual Save issues POST; later saves issue
PUT with the last `serverRevision`. Incomplete persistence drafts are valid, so
Save does not depend on Analyze and never starts analysis.

Dirty state compares only project name plus persisted relation, attributes, and
functional dependencies with the last server snapshot. Analysis, closure, and
transformations do not affect it. Loading a project replaces the draft and
resets computed results. New and Open require explicit discard confirmation
when local persisted fields differ from the last snapshot.

OCC conflicts are never retried. A 409 leaves local edits intact and offers
`Reload saved version` or `Cancel`. Reload explicitly warns that local changes
will be permanently discarded and requires a second confirmation before a GET
replaces the draft, adopts the current server revision, and marks it Saved.
There is no force overwrite in v1.

Delete is a hard server delete with explicit confirmation. If the deleted
project is open, its schema stays visible, association/revision are removed,
and it becomes an unsaved local draft that can be saved as a new project.
Logout and authentication expiry likewise preserve the workspace. Expiry also
keeps the local project association but shows `Sign in to save`. A failed
network logout keeps the authenticated UI and states that the server session is
still active, avoiding a false logout while the HttpOnly cookie remains set.

If an externally deleted current project returns 404 during Save, reload, or
Delete, the frontend removes only the stale project association. Its name and
schema remain an unsaved local draft, and the next Save creates a new project.
The compact list shows at most the 20 most recently updated projects and says so
when the server reports additional projects.

On `INVALID_CSRF_TOKEN`, the frontend calls `/auth/me` once to refresh session
state and never repeats the mutation. The user must explicitly retry Save or
Delete. This avoids replaying a mutation whose outcome may be uncertain.

## Refresh limitation

V1 intentionally keeps route `/` and introduces no router. Browser refresh
recovers auth through the cookie plus `/auth/me`, but resets the workspace and
forgets the open project. Projects can be reopened through the compact list.
A project route or query parameter is deferred until deep links/session restore
become a product requirement.

That requirement is now designed in ADR 017. Until its implementation lands,
the limitation above remains the observable staging behavior.
