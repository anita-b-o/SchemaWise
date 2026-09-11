# Frontend architecture

Status: implemented MVP plus manual project persistence; Educational UX v1.1
is frozen. Project routing/recovery v1.2 Tranches 1–3 are implemented.

## Context and boundaries

`apps/web` is a React 19 + TypeScript + Vite baseline that currently renders
only `SchemaWise baseline`. The MVP remains a single-page, client-rendered
workspace backed by the stateless Computational API v1.

```text
React view
  -> workspace reducer and local validation
  -> frontend DTO mapper
  -> schemawise-api client
  -> Fastify /api/v1
```

The frontend owns interaction, accessible presentation, request state and
deterministic natural-language templates. It does not own normalization
algorithms, server validation, identity, ownership or SQL modeling. It now owns
the local session view and orchestration of the server persistence contract.

## Navigation

React Router 7.18.3 now runs through the stable browser data-router provider
(without loaders/actions) so `useBlocker` can protect navigation. `/` and
`/projects/:projectId` are real routes; authenticated deep links recover their
persisted workspace on refresh. Open/New use route navigation, Save-new uses
replace plus one-shot response adoption, and one dirty guard covers links and
Back/Forward. `beforeunload` exists only while the visible draft is dirty.

`/` remains the anonymous-first new local workspace. `/projects/:projectId`
references a private persisted project; it waits for auth initialization and
hydrates through a single route coordinator. The URL identity is separate from
the loaded server snapshot and mutable draft. No auth, list, settings, sharing,
or analysis route is added. See [ADR 017](../adr/017-project-deep-links.md),
[routing](../frontend/project-routing-v1.2.md), and
[recovery](../frontend/project-recovery-v1.2.md).

## Architectural decisions

### Single reducer, local UI state

`SchemaWorkspace` uses `useReducer` for the schema draft, revision and remote
resource state. Ephemeral presentation state stays near its component. This
keeps cross-feature rules explicit without a global state dependency.

Authentication is the deliberate exception: a focused Context plus reducer
serves header, forms, logout, and project actions. Project session state stays
at the workspace boundary and is not merged into either Auth Context or the
workspace reducer. Server revision and draft revision have distinct meanings.

V1.2 keeps this ownership. The implemented thin project-route hydrator owns
params, auth-gated hydration, route request races, Retry, and title/focus. It
does not absorb draft or auth state. A sibling project-navigation coordinator
owns navigation intents, the stable dirty blocker, unload registration,
save-new adoption, and the detached-draft handoff. Successful hydration uses
the existing `replaceDraft` reset semantics and never invokes analysis. The
same route hydrator handles direct entry, Retry, clean auth reconnection, and
confirmed OCC reload; dirty reconnect does not hydrate.

### Manual persistence snapshots

The project session stores project identity, editable project name, last server
revision and last persisted snapshot. Dirty state compares only persisted
fields. Saving uses OCC; opening/new resets computation resources; deletion
unlinks without destroying the visible draft. There is no autosave, project
cache, state library, or mutation replay.

### Snapshot-based calculations

Each analysis records the exact request and draft revision. Synthesis and BCNF
operate only on that analyzed snapshot. This prevents the results column from
mixing evidence from one schema with a newly edited draft. Closure uses its own
explicit snapshot. Request IDs and abort signals prevent late-response races.

### One typed API adapter

`src/api/schemawise-api.ts` maps exactly five methods to the five v1 endpoints.
No React component contains `fetch`. DTO types mirror OpenAPI rather than engine
classes, preserving `Web -> API -> Engine` dependency direction.

### Deterministic presentation

Pure formatters resolve IDs to names and render attribute sets, FDs and
violation explanations. They may express facts guaranteed by the DTO's context
but do not independently calculate normal forms. Contract anomalies degrade to
an explicit unknown-attribute label and operation error instead of crashing.

Educational UX v1.1 formalizes this boundary as pure, result-specific builders
over typed DTOs and immutable operation snapshots. Mathematical notation is
structured so visual glyphs and accessible names can differ. Builders record
whether a fact comes from the DTO, a trivial snapshot comparison or an
operation guarantee; there is deliberately no frontend-computed mathematical
provenance. See
[`docs/frontend/educational-content-model.md`](../frontend/educational-content-model.md).

The analysis response is sufficient for deterministic candidate-key,
prime-attribute and normal-form explanations, but not for candidate-key closure
expansions or Minimal Cover execution traces. Those claims are omitted rather
than reconstructed. Closure coverage may be compared as sets against its own
captured snapshot after the API has calculated the closure.

Static concept definitions form a separate presentation-only boundary.
`ConceptHelp` and the glossary consume one TypeScript source, keep disclosure
state local, and make no API calls. They are not persisted and cannot affect
draft or project revisions.

### No client draft persistence

State lives in memory and resets on reload. `localStorage` recovery and URL
sharing are separate product features requiring serialization/versioning and
clear reset semantics. They are deliberately deferred.

V1.2 persists only project identity in the pathname and recovers the server
snapshot. Tranche 3 moves detached drafts created by Delete/404 across the
replace-to-`/` transition through a one-shot in-memory coordinator intent.
They are not stored in Web Storage, URL state, or browser history and still
disappear on refresh.

## Responsive architecture

The DOM follows task order: editor before results, summary before detail. CSS
uses a single column at small/medium widths and a two-region grid only when both
regions can meet readable minimum widths. Large screens cap line length and
total width. No component branches into a different mobile application; layout
and a few disclosure defaults adapt responsively.

## Styling architecture

A small `tokens.css` provides spacing, two radii, type scale, surface hierarchy,
borders, accent, focus and semantic colors. `global.css` defines reset,
typography and landmarks; feature styles stay colocated or in plainly named CSS
modules. No external design system, CSS-in-JS runtime or utility framework is
needed for the MVP skeleton.

The intended character is technical and editorial rather than dashboard-like:
strong typography, compact mathematical notation, thin dividers and restrained
surfaces. Status color is supplemental to words and icons.

## Error and accessibility architecture

Local validation produces structured field/section errors. API errors are
normalized once in the client and mapped by stable code. Unexpected errors are
scoped to the operation, preserve the draft, and offer retry. There is no fake
progress.

Accessibility is a component contract: native labels and buttons, full keyboard
operation, visible focus, WCAG 2.2 AA contrast, live request announcements,
semantic disclosures, touch targets, non-color status cues and a linear DOM
order. A custom attribute picker is not complete until its keyboard and screen
reader behavior is tested.

## Suggested implementation slices

1. Establish DTO types, five-method API client, reducer/validation and formatter
   unit tests.
2. Build the accessible relation, attribute and FD editor with limits and load
   example action.
3. Connect analysis and render overview, minimal cover and explanations.
4. Add 3NF synthesis and BCNF decomposition/preservation.
5. Add the closure tool, contextual concept reference, responsive refinement
   and full accessibility/browser verification.

The first slice should be independently typechecked and tested before visual
construction expands.
