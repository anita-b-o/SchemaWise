# Frontend architecture

Status: implemented MVP plus manual project persistence; Educational UX v1.1
is designed but not implemented.

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

Only `/` is required. It renders the workspace directly with compact product
context and optional inline help. No router dependency is introduced for one
route. `/workspace`, `/about`, authentication and settings routes would create
navigation without distinct MVP jobs.

This means refresh recovers authentication but not the in-memory workspace or
open project. The explicit Open projects flow is the recovery path in v1.
Deep-linkable projects are a later routing decision, not implicit localStorage.

If substantial educational reference content appears later, `/how-it-works`
can become the first additional route and justify a router. This is not part of
the current build.

## Architectural decisions

### Single reducer, local UI state

`SchemaWorkspace` uses `useReducer` for the schema draft, revision and remote
resource state. Ephemeral presentation state stays near its component. This
keeps cross-feature rules explicit without a global state dependency.

Authentication is the deliberate exception: a focused Context plus reducer
serves header, forms, logout, and project actions. Project session state stays
at the workspace boundary and is not merged into either Auth Context or the
workspace reducer. Server revision and draft revision have distinct meanings.

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

### No client persistence in tranche one

State lives in memory and resets on reload. `localStorage` recovery and URL
sharing are separate product features requiring serialization/versioning and
clear reset semantics. They are deliberately deferred.

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
5. Add the closure tool, responsive refinement and full accessibility/browser
   verification.

The first slice should be independently typechecked and tested before visual
construction expands.
