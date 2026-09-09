# Project persistence architecture

## Boundaries

SchemaWise has two peer application flows:

```text
Frontend
├── Project Persistence API -> Project application use cases -> ProjectRepository -> database adapter
└── Computational API       -> Computational use cases       -> Normalization Engine v1
```

The Project Persistence API owns resource identity, draft snapshots, lifecycle,
timestamps and concurrency. The Computational API owns deterministic analysis
and transformation. Saving never analyzes; analyzing never saves. Persistence
DTOs may reuse the value shapes of attributes and FDs but do not serialize
engine objects or alter the frozen computational contract.

The Application Layer is the only place allowed to coordinate the flows in a
future use case, for example load-project-then-analyze. Such coordination still
passes a computationally valid DTO through the existing mapper; the engine does
not learn about project IDs, revisions, databases or users.

## Aggregate and ports

`Project` is a small aggregate root whose consistency boundary includes its
immutable owner, name, schema snapshot and revision. Its attributes and FDs are
values inside the snapshot rather than independently addressable persistence
entities.

The `ProjectRepository` port exposes:

```text
create(ownerId, input: NewProject): Project
findById(ownerId, projectId: ProjectId): Project | null
list(ownerId, query: { limit, offset }): { projects: ProjectSummary[], total: integer }
update(ownerId, projectId, expectedRevision, replacement):
  updated(Project) | notFound | revisionConflict(actualRevision)
delete(ownerId, projectId): deleted | notFound
```

The port uses application/persistence values, not HTTP requests, Fastify types,
SQL rows or engine classes. Project IDs are generated server-side before or
during `create`; timestamps and revision returned from persistence remain
server-authoritative. The adapter maps `schema_json` to the versioned
`ProjectSchemaDto` and fails closed on an unsupported stored schema version.

## Validation ownership

The HTTP adapter handles JSON, media type, payload size, path/query parsing and
response mapping. Project application use cases normalize/validate project
names, validate draft structure/references/limits, enforce OCC semantics and map
repository outcomes. Persistence enforces row-level constraints and atomicity.

Common pure primitives for ID format, lengths, collection limits and FD
references should be shared with computational validation. The two top-level
validators remain separate because a valid saved draft may be computationally
incomplete. Database checks do not duplicate deep JSON validation.

## HTTP deployment boundary

The database adapter and project use cases enforce owner-scoped authorization,
and the five Project HTTP routes are registered only when both Auth and a
ProjectRepository are composed. Every request resolves the opaque session before
calling persistence. `POST`, `PUT`, and `DELETE` then reuse the Auth adapter's
Origin/Referer and session-bound CSRF checks. `GET` list/detail need no CSRF.

Dedicated response mappers convert dates to ISO 8601 strings, preserve the
persisted schema in detail responses, emit only compact counts in lists, and
never include `ownerId`. The HTTP list envelope is `{ projects, total, limit,
offset }`. UUID v4 path format is checked before repository access; invalid
format is `400 INVALID_PROJECT`, while scoped absence is `404
PROJECT_NOT_FOUND`. The global 64 KiB body limit covers create and update.

## Future extensions

Immutable `ProjectVersion`, `Snapshot` and `AnalysisRun` resources can later
reference `projectId`, project revision, schema version and engine version. They
are not part of the v1 write model. Search projections, JSONB indexes, archive,
soft delete, autosave, synchronization and collaboration likewise require an
observed product need and their own contracts.
