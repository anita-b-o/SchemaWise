# ADR 009: JSONB snapshots for project schemas

## Status

Accepted

## Context

A project schema contains at most 6 attributes and 12 FDs, is transferred and
edited as a unit, and is not queried by individual attribute or dependency.
Fully normalizing it would require multiple child tables, joins, ordering and
larger migration/transaction surface. A hybrid projection would duplicate data.

## Decision

Store each project in one PostgreSQL row with scalar `id`, `name`, `revision`
and timestamp columns plus a non-null `schema_json` JSONB document. The document
is a DTO envelope containing `schemaVersion: 1`, relation attributes and FDs.
Application code owns deep document and referential validation; the database
owns primary key, non-null fields, positive revision and timestamps. Do not add
a JSONB search index without a query that uses it.

## Consequences

- Aggregate reads and atomic replacements are direct and preserve nested IDs.
- Stored document evolution requires explicit schema-version migrations.
- Deep relational constraints and convenient cross-project attribute analytics
  are traded for a substantially simpler v1 write model.
- A future measured analytics need can add a transactional read projection
  without changing the aggregate snapshot immediately.
