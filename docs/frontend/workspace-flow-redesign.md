# SchemaWise workspace flow redesign

Status: architecture C approved; Multi-Surface Workspace Tranche 1 implemented, 2026-09-21. Visible surface separation remains planned for Tranche 2.

## Tranche 1 implementation contract

`WorkspaceView` is a small URL-derived model with `schema`, `analysis`, and `transform`. `schema` is the default for an omitted `view`, `view=schema`, or any unrecognized value. The canonical Schema URL omits `view`. `?view=analysis` and `?view=transform` express view intent on `/` and `/projects/:projectId`; they are not separate routes or persisted result identifiers. A testable `WorkspaceViewProvider` exposes `activeView`, `goToSchema`, `goToAnalysis`, and `goToTransform`. User view actions push history. They preserve unrelated search parameters; the current app has no other search parameter with product semantics.

Resource identity is `ROOT WORKSPACE` or `PROJECT:<uuid>` (case normalized). It is derived from pathname and never includes `view` or `location.key`. The navigation blocker and dirty reset respond to resource transitions. The explicit New Project action may also reset a root draft while already on `/`; a mere view or history change cannot. Save New adopts the created project with `replace`, retaining a recognized active view and avoiding a second GET. Open and New target Schema by omitting `view`; delete and 404 detachment return to `/` on Schema. Save Existing, logout, reconnect, OCC conflict, and successful reload keep the current URL and view.

Project hydration remains scoped to project ID. Direct entry and refresh at `/projects/:id?view=analysis` recover auth and the saved schema, then expose `activeView=analysis` with analysis/transform/closure data idle because those computations are only in memory. No Analyze request runs automatically. Refresh of `/?view=analysis` retains view intent and may lose the anonymous draft under the existing contract. During an in-flight GET, a view change does not abort or restart the request; the route ID, request ID, response ID, and AbortController guards still handle real project transitions. `beforeunload` remains tied to dirty state.

Tranche 1 deliberately keeps the existing `SchemaWorkspace` mounted and renders its Input and Results together for every view. It adds no visible navigation, focus movement, empty state, layout, birds, or footer changes. A future tranche will present distinct surfaces and explain unavailable computed data.

## Evidence and limits

- The deployed [FlowMind](https://flowmind-anita-b-o.vercel.app/) homepage links to registration and sign in. Its protected `/workflows` and `/dashboard` routes redirect an anonymous visitor to `/login`. The deployed protected editor could not be inspected without an account. The read-only local FlowMind checkout at `/home/anita/Desktop/Workspace/flowmind` supplies supplementary evidence for the authenticated shell, workflow editor, run dialog, and execution detail. Deployment and checkout equivalence was not verified.
- The deployed [SchemaWise](https://schemawise.vercel.app/) was exercised anonymously with Load example and Analyze at 1440, 390, and 320 px. Analyze retains `/`, leaves the complete input visible, and adds results in the same workspace. At 390 px the example page measured 2,971 px before Analyze and 4,357 px after Analyze (browser `body.scrollHeight`; one captured viewport and content state, not a usability benchmark).
- Current SchemaWise source and the v1.2 Project Recovery and v1.4 UX simplification design documents were read. This proposal preserves their computational and persistence contracts.

## Product decision

Approved: **C. Adopt multi-surface workspace** with three freely navigable local surfaces: **Schema**, **Analysis**, **Transform** (working labels; page heading can say “Transformations”). This is a small information architecture change inside the existing workspace, not an account dashboard, wizard, new data model, or visual rebrand. Tranche 1 provides their URL identity and navigation API; users still see the current combined workspace.

The user job remains **DEFINE → ANALYZE → UNDERSTAND → VISUALIZE → TRANSFORM**. Analyze is the deliberate boundary between an editable draft and a computed snapshot. Analysis explains that snapshot; Transform operates on that snapshot.

### Alternatives evaluated

| Alternative | Shape | Benefit | Cost and failure mode | Complexity |
| --- | --- | --- | --- | --- |
| A. Workspace with local navigation | Three conditional panes, UI state only | Smallest migration, mobile length drops | Refresh and browser Back do not preserve the selected surface; no view deep link | Low to medium |
| B. Master/detail | Persistent draft rail plus focused result pane | Fast desktop edit/result comparison | Recreates the current mobile stack unless the rail becomes a separate mobile surface; draft and snapshot remain visually easy to confuse | Medium |
| C. Addressable workspace surfaces | One workspace state owner; surface selected by `?view=analysis` or `?view=transform` on `/` and `/projects/:id` | Clear location, Back/Forward, shareable view intent, usable anonymously | Requires careful in-session state preservation and route/recovery changes; a refreshed URL cannot recover computed results | Medium |

Path-per-surface routing, such as `/projects/:id/analysis`, is an optional future variant of C. It costs more and falsely suggests analysis is a stored resource unless empty-state semantics are very clear. Query parameters are sufficient for this scope.

## Navigation and lifecycle contract

- `/` opens a new, anonymous-capable Schema surface. `/projects/:projectId` opens a saved schema on Schema. `?view=analysis` and `?view=transform` select a surface within the same workspace; omitted or unknown values fall back to Schema. Switching surfaces pushes history so Back and Forward retrace them.
- Surface switches preserve the single mounted workspace draft, computed resources, and project session. They never trigger project hydration, dirty-project discard prompts, draft reset, Save, Analyze, or a transformation request. A project ID change retains the existing Project Navigation Coordinator blocker and recovery flow.
- Direct entry or refresh on a saved project view hydrates its schema under the existing auth gate, without automatically computing analysis. Tranche 2 will show an explicit “Analyze this schema to continue” empty state linking to Schema in Analysis and Transform. The URL expresses intended surface, not a promise that a result has been stored. Anonymous refresh may still reset the workspace as contracted.
- Saving a new project replaces `/` with `/projects/:id` while preserving the selected surface and in-memory analysis. On refresh, only the saved schema returns. Opening a different project defaults to Schema unless the destination URL explicitly requests another surface.
- Before Tranche 1, `ProjectNavigationCoordinator` cleared dirty state on every `location.key` change, and `SchemaWorkspace` treated a return to `/` with a new key as a new project. Tranche 1 gates those transitions by resource identity and explicit New intent, while retaining adoption, detachment, route coherence, auth recovery, conflict handling, and browser unload behavior.

## Surface model

| Surface | Main content and primary action | Secondary/utility actions |
| --- | --- | --- |
| Schema | Relation, attributes, FDs, validation; **Analyze schema** | Load example, contextual Closure, Save/project controls |
| Analysis | Analyzed relation, candidate keys, prime attributes, normal forms, issue evidence, minimal cover, contextual Explain and Formal reasoning; **Explore transformations** when relevant | Edit schema, Diagram, concept reference in contextual disclosure |
| Transform | 3NF synthesis, BCNF decomposition, dependency preservation and result diagrams; operation-specific **Run 3NF** or **Run BCNF** before results | Back to analysis, Edit schema, Check preservation after BCNF |

Analysis may still offer Transform when 3NF/BCNF are satisfied, but should state that no repair is required and explain available explorations. Do not fabricate a required next step.

### Analyze transition

On successful Analyze, navigate to Analysis and focus its heading after the result commits. During the request, remain on Schema with loading and retry/error feedback next to Analyze. A response for an earlier draft revision may create a historical result; its Analysis surface must immediately say Out of date. Analysis errors leave the current surface and prior snapshot intact. “Edit schema” returns to the draft without resetting the result. No automatic save.

### Snapshot and stale state

Keep the current distinction between project Save state and analysis currency. The compact global context shows project name plus Saved/Unsaved, relation, attribute and FD counts. When a result exists, the Analysis and Transform headers show the analyzed relation and **Current** or **Out of date**. If stale, show a text notice that the result describes the earlier analyzed schema, allow reading its explanations and existing transformation outputs, disable new transformation and preservation requests, and link to Schema to run Analyze again. Any historical candidate key must be labeled as belonging to the analyzed snapshot. A successful new analysis invalidates transformation results for a changed revision as the reducer already does.

### Diagram, Closure, teaching

Diagram remains inside Analysis as an optional mode/disclosure reached from an issue or the Diagram control. Transformation-specific diagrams remain alongside transformation results and reuse the existing visualization model. Closure stays a contextual utility in Schema because it operates on the draft and does not require Analyze. Explain and Formal reasoning stay adjacent to each result; Concept Reference stays a closed disclosure, not primary navigation.

## Shell wireframes

Desktop:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ SchemaWise                           Project name · Save · Account  │
├──────────────────────────────────────────────────────────────────────┤
│ Schema       Analysis       Transform                               │
│ R · 3 attributes · 2 FDs             Current / Out of date          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                    ONE ACTIVE SURFACE                                │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ Developed by Pampa Software                                         │
└──────────────────────────────────────────────────────────────────────┘
```

Mobile, including 320 px:

```text
┌──────────────────────────────┐
│ SchemaWise        Project menu│
│ R · 3 attrs · 2 FDs           │
│ Schema | Analysis | Transform │
│ Current / Out of date        │
├──────────────────────────────┤
│ ONE ACTIVE SURFACE           │
│                              │
│ Contextual primary action    │
├──────────────────────────────┤
│ Developed by Pampa Software  │
└──────────────────────────────┘
```

The navigation labels are short enough to fit at 320 px without a fixed sidebar. Use ordinary links in a labeled local navigation landmark with `aria-current="page"`, not an ARIA tab widget unless full tab keyboard behavior is implemented. The shell follows DOM order. The birds appear only in the Schema entry introduction; the existing global Pampa Software footer and link remain.

## FlowMind principles and limits

The deployed public flow proves a clear entry to account creation/sign in. The local checkout shows resource list → workflow detail/editor, a persistent product shell, editor modes, Run → execution detail, and links back from an execution to the executed workflow version. Those separate the objects and their tasks. Its workflow editor and execution detail are still content-dense; the pattern to adopt is **task separation and traceable context**, not a guarantee of short pages. FlowMind's mandatory auth, organization/workflow sidebar, dashboard, versioning, runtime observability, and operational recovery are specific to automation software and should not become SchemaWise navigation.

## Example journeys

- First-time: `/` Schema → Load example → Analyze → Analysis heading and normal-form issue → Explain issue → Diagram → Explore transformations. The number of deliberate concepts stays similar, with one explicit exploration action and much less cross-section scrolling. The current mobile example requires scrolling past the full editor to get to results; the new surface starts at the analysis heading. Proposed scroll savings need measurement in implementation.
- Experienced: open saved project → Schema → edit FD → Analyze → Analysis → Transform → compare BCNF/preservation → Schema to edit. Local surface changes must preserve the in-memory project and avoid confirmation prompts; only project changes invoke the discard guard.
- Mobile at 390 px: use compact local navigation and one document scroll per surface; no fixed sidebar or parallel column. Verify at 320 px that labels, equations, controls and focus indicators fit without horizontal page overflow.

## Accessibility

Use one `h1` for the active surface, nested headings for results, header/navigation/main/footer landmarks, ordinary links for addressable surface changes, focus the new surface heading after explicit view navigation or successful Analyze, and announce loading/errors without unexpected focus jumps. Browser Back/Forward must restore the intended surface and focus context. Disabled unavailable surfaces need a visible explanation; stale historical surfaces remain reachable. Preserve text labels alongside currency color and keep visual and DOM order aligned.

## Migration plan and risk

1. Establish a single workspace state owner and a surface selector; update project navigation assumptions so only project identity changes reset/hydrate/guard. Keep route recovery tests as a gate.
2. Move existing input and Closure into Schema; implement Analyze success transition, focus, and no-result states.
3. Split the current `AnalysisResults` presentation into Analysis and Transform composition while reusing educational builders, normal-form components, transformation components, visualization models, and the reducer/API calls. Preserve stale guarantees.
4. Add query URL history, refresh/Back behavior, mobile shell, accessible navigation/focus, and end-to-end recovery checks. Rollout may place history hardening in the first tranche before any navigation is exposed.

Expected scope: roughly 8–12 frontend files plus focused route/workspace/education tests and this design document; no backend or database changes. Main risk is accidental draft loss on query changes, followed by misrepresenting a refreshed result URL as a stored analysis. Keep `SchemaWorkspace` as the state owner initially; do not rewrite the normalization engine, API contracts, auth, Project Navigation Coordinator's resource transitions, educational content, or diagram model.

The architecture above is approved. The migration plan's visible composition and interaction steps remain future work; Tranche 1 establishes URL, navigation, history, and recovery safety only.
