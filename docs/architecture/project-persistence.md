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

`Project` is a small aggregate root whose consistency boundary includes name,
schema snapshot and revision. Its attributes and FDs are values inside the
snapshot rather than independently addressable persistence entities.

The conceptual `ProjectRepository` port exposes:

```text
create(input: NewProject): Project
findById(projectId: ProjectId): Project | null
list(query: { limit, offset }): { projects: ProjectSummary[], total: integer }
update(projectId, expectedRevision, replacement):
  updated(Project) | notFound | revisionConflict(actualRevision)
delete(projectId): deleted | notFound
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

## Deployment boundary

Implement and test the database adapter and project use cases before auth if
useful, but do not register public production project routes until authentication
and owner-scoped authorization exist. No nullable owner or global implicit user
is part of v1. The future ownership change must update repository selectors and
uniqueness/access rules so knowledge of a project UUID never grants access.

## Future extensions

Immutable `ProjectVersion`, `Snapshot` and `AnalysisRun` resources can later
reference `projectId`, project revision, schema version and engine version. They
are not part of the v1 write model. Search projections, JSONB indexes, archive,
soft delete, autosave, synchronization and collaboration likewise require an
observed product need and their own contracts.
