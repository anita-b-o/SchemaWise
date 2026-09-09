# Project ownership v1

Status: accepted design; implementation is out of scope for this tranche.

## Aggregate and public boundary

Authentication ownership extends the existing Project Persistence v1 aggregate:

```text
Project {
  id: ProjectId
  ownerId: UserId
  name: string
  schema: PersistedSchema
  revision: positive integer
  createdAt: Instant
  updatedAt: Instant
}
```

`ownerId` is required and immutable for v1. It belongs to the Project
application/persistence boundary, not to the Normalization Engine or the frozen
Computational API. It need not appear in `ProjectResponse` or summaries because
the only visible projects belong to the authenticated user and no sharing or
transfer UI exists.

All project routes require an active session:

| Method and route | Ownership rule |
| --- | --- |
| `POST /api/v1/projects` | create for authenticated `userId` |
| `GET /api/v1/projects` | list and count only authenticated user's rows |
| `GET /api/v1/projects/{projectId}` | find by owner and project ID |
| `PUT /api/v1/projects/{projectId}` | update by owner, ID and expected revision |
| `DELETE /api/v1/projects/{projectId}` | delete by owner and project ID |

The request body never accepts `ownerId`. The HTTP adapter resolves the session
to `AuthContext { userId }`; project use cases receive that application value
explicitly and pass it to the repository. A caller cannot select, override or
transfer ownership.

## Repository contract

The future port is conceptually:

```text
create(ownerId, newProject): Project
findById(ownerId, projectId): Project | null
list(ownerId, { limit, offset }): { projects: ProjectSummary[], total: integer }
update(ownerId, projectId, expectedRevision, replacement):
  updated(Project) | notFound | revisionConflict(actualRevision)
delete(ownerId, projectId): deleted | notFound
```

The exact enforcement boundary is deliberately redundant: application use cases
require an authenticated `userId`, and every repository selector includes it.
The HTTP adapter must never call `findById(projectId)` and perform an owner check
afterward. A database role/RLS policy is not required in v1, but repository SQL
must fail closed even if a handler or use case is later refactored.

## Absence and disclosure

A project outside the caller's owner scope is indistinguishable in the public
contract from a nonexistent project. `GET`, `PUT` and `DELETE` return the same
`404 PROJECT_NOT_FOUND` status, code, message and detail shape for both cases.
They never return `403` for ownership. List results and their exact `total`
contain only rows whose `owner_id` is the authenticated user.

Implementation and logs must not add avoidable distinctions such as an
unscoped existence query, different error messages or constraint details.
Perfect timing equality is not promised, but both paths use the same scoped
query path. Internal operators may investigate via privileged tooling outside
the public request flow.

## SQL scoping

Read and delete predicates are respectively:

```sql
WHERE owner_id = $ownerId AND id = $projectId
```

and list/count both use:

```sql
WHERE owner_id = $ownerId
```

Ordering remains `updated_at DESC, id ASC`; pagination remains limit/offset with
default 20 and maximum 100. The total is computed under the same owner predicate.

## OCC within owner scope

Update atomically requires all three authorization/concurrency values:

```sql
UPDATE projects
SET name = $name,
    schema_json = $schema,
    revision = revision + 1,
    updated_at = now()
WHERE owner_id = $ownerId
  AND id = $projectId
  AND revision = $expectedRevision
RETURNING ...
```

If no row is returned, the adapter checks current revision inside the same
transaction using **both** `owner_id` and `id`:

- no row in owner scope: `notFound` -> `404 PROJECT_NOT_FOUND`;
- row in owner scope with another revision: `revisionConflict(actualRevision)`
  -> `409 PROJECT_REVISION_CONFLICT`;
- a concurrent delete that leaves no scoped row: `notFound`.

The fallback must never query by project ID alone. Consequently an attacker who
guesses another user's ID cannot receive its current revision or distinguish it
from a random UUID. OCC semantics for the owner remain unchanged: a conflict
writes nothing and revision increments exactly once on success.

## Database relation and deletion

`projects.owner_id` is a non-null UUID foreign key to `users.id`. The index
`(owner_id, updated_at DESC, id ASC)` supports scoped ordering and has
`owner_id` as a prefix for owner counts/lookups. The primary key continues to
enforce global project identity.

The foreign key uses `ON DELETE RESTRICT` (or the equivalent default), because
v1 has no delete-account workflow and implicit destruction of projects would be
unsafe. A future account-deletion design must explicitly choose export,
retention and transactional deletion behavior. Sessions use cascade because
they are credentials with no independent lifetime.

## Existing local projects

There is no production or public project data. Before applying the ownership
migration, developers and tests reset their local/test databases after exporting
anything they deliberately want to preserve. The migration adds `owner_id NOT
NULL` and intentionally requires `projects` to be empty; it does not create a
placeholder owner, infer ownership, delete rows silently or leave a nullable
authorization window.

If real data exists before implementation, this assumption is invalid and the
migration must stop for a separate explicit-user backfill plan. That is not a
reason to weaken the target schema now.

## Required authorization tests

At minimum, integration and HTTP coverage proves that user A cannot list, count,
read, update or delete user B's projects; foreign and missing IDs have identical
public outcomes; creation always uses session identity; and OCC still reports a
conflict only for a stale revision inside the caller's owner scope.
