# ADR 010: Optimistic concurrency for project updates

## Status

Accepted

## Context

Project snapshots can be open in multiple tabs or saved after delayed requests.
An unconditional full replacement could silently overwrite a newer save even
before collaboration or multiple users exist.

## Decision

Each project has a positive integer `revision`, initialized to 1. Every update
requires `expectedRevision` and atomically replaces name/schema while incrementing
revision exactly once if the stored value matches. A mismatch changes nothing
and returns `409 PROJECT_REVISION_CONFLICT`. The repository reports updated,
not-found and conflict as distinct outcomes.

## Consequences

- Lost updates are detected without database locks spanning user think time.
- Clients must retain the last server revision and provide conflict UX.
- Full-snapshot `PUT` remains safe and atomic.
- Frontend draft revisions and persisted project revisions must remain separate.
