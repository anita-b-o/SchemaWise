# ADR 013: Owner-scoped project persistence

## Status

Accepted

## Context

Knowledge of an opaque project UUID must never grant access. An authorization
check confined to an HTTP handler could be omitted by another adapter and would
allow unscoped database reads before denial. OCC also needs to distinguish a
visible stale revision from absence without disclosing another user's row.

## Decision

Add immutable, non-null `Project.ownerId`. Project use cases require an explicit
authenticated user ID, and all ProjectRepository operations accept it. Every
read, list/count, update and delete SQL statement filters by `owner_id`; create
gets owner identity only from server auth context. Foreign and absent projects
both return `404 PROJECT_NOT_FOUND`. OCC follow-up reads remain inside owner
scope and never query by project ID alone.

## Consequences

- Authorization is visible in application contracts and enforced next to data
  access rather than depending on Fastify handlers.
- Lists and totals cannot contain another user's projects.
- Owners retain the existing revision-conflict behavior; non-owners cannot learn
  current revision or existence.
- Existing unowned local/test rows must be reset before the non-null ownership
  migration; no placeholder or nullable production state is accepted.
