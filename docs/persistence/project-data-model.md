# Project data model v1

## Logical model

```text
Project (aggregate root)
├── id: UUID
├── ownerId: UUID (required, immutable)
├── name: string
├── schema: ProjectSchemaDto
│   ├── schemaVersion: 1
│   ├── relation
│   │   ├── name: string
│   │   └── attributes: [{ id, name }]
│   └── functionalDependencies: [{ left: [attributeId], right: [attributeId] }]
├── revision: positive integer
├── createdAt: instant
└── updatedAt: instant
```

`Project.name` and `relation.name` are independent display values. The first
names the saved exercise; the second names the relational schema being edited.

## Persisted schema envelope

`ProjectSchemaDto` is a stable JSON DTO, not a normalization-engine object:

```json
{
  "schemaVersion": 1,
  "relation": {
    "name": "ENROLLMENT",
    "attributes": [
      { "id": "attr_550e8400-e29b-41d4-a716-446655440000", "name": "Student ID" },
      { "id": "attr_2c1f74d0-b57d-4f7c-a716-446655440001", "name": "Course ID" }
    ]
  },
  "functionalDependencies": [
    {
      "left": ["attr_550e8400-e29b-41d4-a716-446655440000"],
      "right": ["attr_2c1f74d0-b57d-4f7c-a716-446655440001"]
    }
  ]
}
```

The `relation`, attribute and FD shapes intentionally reuse the stable concepts
of the computational DTOs. The envelope is distinct because it permits
incomplete drafts and carries `schemaVersion`. It must never serialize engine
classes, `Map`, `Set`, private collections or analysis results.

Array order is preserved. Attribute IDs are persisted exactly and are never
regenerated on load. FD sides may be empty, as in the computational contract;
each side contains unique IDs and every ID must exist in `relation.attributes`.

## Storage options

### Fully relational

Tables for projects, relations, attributes, FDs and FD sides offer granular
foreign keys and SQL queries over individual schema elements. They also require
many rows, ordering columns, joins and multi-table write transactions for an
aggregate that is always loaded and replaced as one unit. This creates more
schema/migration surface than current product queries justify.

### Project row plus JSONB snapshot

A `projects` row stores scalar metadata and one `schema_json` JSONB document. It
matches the API/write unit, preserves nested IDs and arrays, makes atomic
replacement simple, and keeps revision locking in one row. Its costs are weaker
deep database constraints, JSON document migrations, and less convenient SQL
analytics over attributes and FDs.

### Hybrid projections

JSONB plus normalized child tables or duplicated searchable columns can optimize
future cross-project analytics, but it introduces two representations that must
remain transactionally consistent. There is no current query that earns this
complexity. `relationName`, counts or other summary values should not be stored
as projections in v1; list summaries can be derived cheaply from bounded JSONB.

## Decision

Use one `projects` table with scalar columns and a JSONB schema snapshot:

| Conceptual column | Meaning |
| --- | --- |
| `id` | UUID primary key |
| `owner_id` | required owner UUID referencing `users(id)` with delete restricted |
| `name` | normalized project display name |
| `schema_json` | non-null `ProjectSchemaDto` JSONB envelope |
| `revision` | positive optimistic-concurrency integer, initially 1 |
| `created_at` | server-generated UTC `timestamptz` |
| `updated_at` | server-generated UTC `timestamptz` |

This is the JSONB-snapshot option, not a normalized child model. The aggregate
has at most 6 attributes and 12 FDs, is loaded/saved as a unit, and has no
attribute-level query requirement. The primary key index remains global, while
`(owner_id, updated_at DESC, id ASC)` supports owner-scoped counts and ordered
lists. No GIN JSONB index is justified in v1 because no API filters inside the
document.

If future product requirements add cross-project attribute/FD analytics, measure
the query first. Add a transactional projection or normalized read model then;
do not compromise the aggregate write model speculatively.

## Database constraints

The database should enforce only robust row invariants:

- primary key on `id`;
- `owner_id`, `name`, `schema_json`, `revision`, `created_at` and `updated_at` are non-null;
- `owner_id` references `users(id)` with `ON DELETE RESTRICT`;
- `revision > 0`;
- `schema_json` is a JSON object (a shallow shape check is optional);
- project names are not unique.

Deep JSON shape, collection limits, referential integrity inside FDs and draft
semantics remain Application Layer responsibilities. Reproducing the full JSON
contract as database `CHECK` expressions would create a second validator that
is hard to evolve safely.

## Draft integrity and limits

All properties are required and unknown properties are rejected. V1 applies:

| Field | Draft rule |
| --- | --- |
| `schemaVersion` | exactly integer `1` |
| project name | trim on input; 1–120 characters after trim |
| relation name | 0–120 characters; exact draft text retained |
| attributes | 0–6 |
| attribute ID | nonblank, no surrounding whitespace, max 64, unique and immutable within logical history |
| attribute name | 0–120 characters; exact draft text retained |
| functional dependencies | 0–12 |
| each FD side | array of unique known attribute IDs; empty allowed |
| request body | 64 KiB maximum unless the Project API later documents a lower limit |

Drafts may contain duplicate visible attribute names because the editor can be
saved midway through resolving them; computational validation continues to
reject the current frontend-invalid state before analysis. Duplicate attribute
IDs and stale FD references are corruption, not incompleteness, and are always
rejected. Duplicate whole FDs are accepted structurally for parity with the
computational DTO; the UI may continue to prevent them as an editing aid.

## Schema evolution

`schemaVersion: 1` belongs inside `schema_json`, not in computational requests.
It versions the stored document independently from database migrations, Project
API major versions and engine versions. Readers must dispatch explicitly on it;
unknown values are not coerced. A future incompatible document becomes version
2 through a tested data migration or an explicit read-upgrade/write-back plan.
The outer project row remains stable while the nested representation evolves.
