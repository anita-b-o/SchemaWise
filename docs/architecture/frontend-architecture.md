# Frontend architecture

Status: implemented MVP plus manual project persistence; Educational UX v1.1
and locally audited Project Recovery + Deep Links v1.2 are frozen. UX
Simplification v1.4 reorganizes the existing frontend surfaces without changing
those state or service boundaries. Multi-Surface Workspace Tranche 2 now renders
one active Schema, Analysis, or temporary Transform surface at a time.

## Context and boundaries

`apps/web` is a React 19 + TypeScript + Vite application. The MVP remains a single-page, client-rendered
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

`?view=analysis` and `?view=transform` select local workspace surfaces on
either route. Schema is the default. Ordinary links push surface history while
preserving the mounted `SchemaWorkspace` owner; surface changes do not hydrate,
compute, or invoke the dirty resource blocker. Successful Analyze selects
Analysis. Direct Analysis entry without an in-memory result shows an empty
state, even after a saved project schema hydrates.

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

Vercel routing keeps `/api/v1/(.*) -> /api/proxy` before the final
`/(.*) -> /index.html` SPA fallback. Configuration assertions make this order a
release invariant, while the Function itself rejects direct `/api/proxy`
requests. Static assets retain Vercel filesystem precedence.

### Manual persistence snapshots

The project session stores project identity, editable project name, last server
revision and last persisted snapshot. Dirty state compares only persisted
fields. Saving uses OCC; opening/new resets computation resources; deletion
unlinks without destroying the visible draft. There is no autosave, project
cache, state library, or mutation replay.

### Snapshot-based calculations

Each analysis records the exact request and draft revision. Synthesis and BCNF
operate only on that analyzed snapshot. This prevents Analysis from mixing
evidence from one schema with a newly edited draft. Closure uses its own
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

V1.4 composes contextual definitions into the result's single native Explain
disclosure. Identical displayed violation dependencies are grouped for Level 1
presentation only; their typed 2NF/3NF/BCNF evidence and formal rules remain
separate. This grouping is a display transformation, not a new mathematical
inference.

Schema Visualization v1.3 follows the same boundary. Pure builders map DTOs
and the appropriate snapshot to short-lived diagram models; semantic HTML/CSS
renders those models without graph or layout libraries. Schema mode may read
the current draft and is labeled accordingly. Analysis, 3NF, BCNF and
preservation diagrams read only the immutable analyzed snapshot and returned
DTO evidence. Composite determinants remain one set-valued endpoint. Diagram
selection is local presentation state and cannot mutate a schema, revision or
calculation resource. See [ADR 018](../adr/018-schema-visualization.md).

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

The active surface has one document scroll. Schema centers the editor and
Closure; Analysis caps reading width and presents summary before detail. The
old parallel editor/results grid and nested sticky editor scroll are gone.
Small screens keep the same semantic content in a single column; the local
navigation fits at 320 px. The shared context and project controls stay above
the active surface at every viewport width.

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
