# ADR 008: Project as the persistence aggregate

## Status

Accepted

## Context

SchemaWise must save an editable relation and its functional dependencies
without coupling persistence to normalization-engine classes. The schema is
small, loaded and saved as one workspace, and has no independently addressable
attribute or FD resources.

## Decision

`Project` is the aggregate root for project identity, display name, complete
versioned schema draft, persisted revision and timestamps. Attributes and FDs
remain nested DTO values; their frontend-generated attribute IDs are preserved,
but they receive no database identity in v1. Saving replaces the aggregate
atomically and does not invoke the engine.

## Consequences

- Project lifecycle and consistency have one explicit boundary.
- Stable attribute IDs continue to support FD references and renames.
- Persistence stores DTO values, never engine classes or internal collections.
- Fine-grained attribute/FD writes and independent queries are intentionally
  unavailable until a concrete requirement justifies changing the model.
