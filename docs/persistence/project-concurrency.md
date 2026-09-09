# Project revision and concurrency v1

## Optimistic Concurrency Control

Every project has a positive integer `revision`. Creation sets it to 1. Each
successful update increments it exactly once. A client sends the last revision
it read as `expectedRevision`; the server accepts the replacement only when it
matches the stored value.

```text
read project at revision 3
        |
edit local draft
        |
PUT expectedRevision 3
        |
atomic compare-and-update
   | match          | mismatch
revision becomes 4  409 PROJECT_REVISION_CONFLICT
```

This is Optimistic Concurrency Control (OCC). It prevents lost updates even
before multi-user collaboration exists: two tabs, retries or delayed requests
can otherwise overwrite newer state. A conflict never performs a partial write
and never increments revision.

`expectedRevision` is a required positive integer in `UpdateProjectRequest`.
It belongs to the Project Persistence contract, not to the computational DTO.
V1 does not use ETags or `If-Match`; one explicit mechanism avoids two sources
of truth. A future HTTP conditional-header facade may map to the same application
precondition without changing repository semantics.

## Atomic update

The conceptual database operation is:

```text
update projects
set name = replacement name,
    schema_json = replacement schema,
    revision = revision + 1,
    updated_at = server time
where id = projectId and revision = expectedRevision
return the updated row
```

This is descriptive pseudocode, not a migration or implementation. Name,
schema, revision and update timestamp change in one transaction or none change.
Relation and FDs are never saved in independent transactions.

If the conditional update affects no row, the adapter checks existence/current
revision within the transaction: absent maps to `PROJECT_NOT_FOUND`; present
maps to `PROJECT_REVISION_CONFLICT`, with the observed `actualRevision` when safe.
A concurrent delete observed during this resolution maps to not found. Adapters
must not collapse both cases merely because both initially affect zero rows.

Create and hard delete are also single-transaction operations. Delete does not
require `expectedRevision` in v1; explicit user confirmation and the small CRUD
contract are sufficient. If stale-delete protection becomes a requirement, it
must be added deliberately to both HTTP and repository contracts.

## Repository outcome

The repository must return a discriminated outcome rather than throw for normal
OCC flow:

```text
updated(Project) | notFound | revisionConflict(actualRevision)
```

Conflicts and absence are expected application outcomes. Connection failures,
transaction aborts and corrupt stored documents are unexpected adapter failures
and are translated at the Application Layer to `PERSISTENCE_ERROR`.

## Local versus persisted revisions

The frontend's current workspace `revision` is a monotonic local mutation
counter used for request snapshots. It is conceptually `draftRevision` and may
start at zero each session. `project.revision` is server-authoritative and starts
at one per project. Neither value is derived from the other. A save captures a
local snapshot and the current project revision; only the successful response
advances the stored revision known by the client.
