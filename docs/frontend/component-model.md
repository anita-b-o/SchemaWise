# Frontend component model

> This is the implemented v1 baseline plus the Educational UX v1.1 Tranche 1.
> The remaining v1.1 extension is defined by [educational-ux-v1.1.md](./educational-ux-v1.1.md) and
> [educational-content-model.md](./educational-content-model.md).

## Component hierarchy

The first implementation should prefer cohesive feature components over a
component per label or row.

```text
App
└─ SchemaWorkspace
   ├─ ProductHeader
   ├─ SchemaEditor
   │  ├─ RelationEditor
   │  ├─ AttributeList
   │  ├─ FunctionalDependencyEditor
   │  │  ├─ DependencyComposer
   │  │  └─ DependencyList
   │  ├─ AnalyzeAction
   │  └─ ClosureTool
   └─ ResultsWorkspace
      ├─ AnalysisOverview
      │  ├─ CandidateKeysResult
      │  └─ PrimeAttributesResult
      ├─ NormalFormSummary
      ├─ ViolationDetails
      ├─ MinimalCoverResult
      ├─ SynthesisResult
      └─ BcnfResult
         └─ DependencyPreservationResult
```

For Educational UX v1.1, extend these cohesive result components rather than
adding a parallel tutorial tree. The only new semantic responsibilities are
`CandidateKeyExplanation`, `PrimeAttributeOrigins`, `FormalReasoning`,
`ConceptHelp`, accessible math-notation primitives and
`PropertyProvenance`. Generic educational card/container wrappers remain
explicitly deferred.

`AttributeSet` and `FunctionalDependencyNotation` are small shared primitives
justified by repeated formatting. The input editor uses native checkbox groups
while the product limit remains six attributes. Generic
`Card`, `Stack`, `Badge` abstractions are deferred until repetition proves a
stable API; initial styles can use semantic classes and tokens.

The persistence extension keeps three ownership boundaries:

```text
App
└─ AuthProvider                         session user + CSRF only
   └─ SchemaWorkspace
      ├─ Project bar                    project session + manual actions
      ├─ AuthPanel                      inline, focused form
      ├─ ProjectListPanel               fresh compact list
      ├─ OCC / confirmation panels
      └─ Existing editor and results    workspace reducer
```

`AuthProvider` does not own workspace or project data. `SchemaWorkspace` owns a
small `ProjectSession` alongside the existing reducer; it keeps server revision,
last saved snapshot, association, and sync availability separate from the
workspace draft revision. Panels receive callbacks and DTOs rather than calling
fetch. Native sections and controls avoid an inaccessible custom dialog while
still moving initial focus to the close/email control.

## Responsibilities

- `SchemaWorkspace` owns the reducer, analyzed snapshot, request lifecycles and
  stale-result policy.
- `SchemaEditor` composes input sections and reports semantic draft actions. It
  does not call HTTP.
- `RelationEditor` owns relation name interaction; `AttributeList` adds,
  renames and safely removes stable attribute identities.
- `FunctionalDependencyEditor` owns composer/list editing and prevents invalid
  references. Its checkbox groups operate on IDs but display names.
- `AnalyzeAction` exposes submit state and validation summary without owning
  validation rules.
- `ResultsWorkspace` receives an immutable result view model and never reads
  mutable input directly.
- `ViolationDetails` maps typed evidence to fixed explanation templates.
- `SynthesisResult`, `BcnfResult` and preservation result render separate
  asynchronous resources. `BcnfResult` owns the contextual preservation action,
  which consumes its leaf attribute sets plus the immutable analysis snapshot.
- `ClosureTool` is independent of analysis but consumes the current draft
  snapshot and API boundary. Its checkbox selection is local visual state; the
  reducer owns request status, selected input, response snapshot and stale
  state.

## Feature-oriented source layout

```text
src/
├─ api/
│  ├─ schemawise-api.ts
│  └─ schemawise-contracts.ts
├─ components/
│  ├─ attribute-picker.tsx
│  ├─ attribute-set.tsx
│  └─ functional-dependency-notation.tsx
├─ features/
│  ├─ schema-editor/
│  ├─ analysis-results/
│  ├─ transformations/
│  └─ closure/
├─ state/
│  ├─ schema-reducer.ts
│  ├─ schema-validation.ts
│  └─ view-models.ts
├─ styles/
│  ├─ tokens.css
│  └─ global.css
├─ app.tsx
└─ main.tsx
```

Do not create barrel files initially. Imports should reveal feature ownership.

## State ownership

Educational disclosure state, active glossary concept and optional evidence
selection stay UI-local. They are not fields of the workspace reducer, project
session, persisted schema or dirty comparison; opening help must not change
draft revision, server revision or trigger a calculation.

One `useReducer` at workspace level is sufficient. The canonical draft stores
relation, attributes and FDs by stable ID; form-only state such as an open
picker or current rename field stays local to the relevant component.

```ts
type SchemaDraft = {
  relationName: string;
  attributes: AttributeDraft[];
  functionalDependencies: FunctionalDependencyDraft[];
  revision: number;
};

type Resource<T> =
  | { status: "idle" }
  | { status: "loading"; requestId: string }
  | { status: "success"; data: T; sourceRevision: number }
  | {
      status: "error";
      error: ApiError | UnexpectedApiError;
      previous?: T;
    };
```

Analysis, synthesis, BCNF, preservation and closure each use a separate
`Resource<T>`. A successful analysis also stores the exact normalized request
snapshot. Transformations consume that snapshot; closure consumes a separately
captured current-draft snapshot and does not require analysis. `sourceRevision !==
draft.revision` means stale. Editing the draft invalidates transformation
eligibility and preservation context but does not discard useful visible data.
Only analysis success for a new input revision resets all three transformation
resources; retries retain previous data through loading and error states.

No Redux, Zustand, server cache or React Query is warranted: there is one
workspace, no shared remote resource graph and all operations are explicit POST
calculations. Abort controllers and request IDs handle concurrency locally.

## View models

DTO types stay in `api/`. Presentation helpers build view models by resolving
IDs against the relation returned with analysis or the analyzed request snapshot.
Unknown IDs are rendered as `Unknown attribute (id)` and recorded as a contract
error; rendering must not crash. Helpers are pure and unit-testable.

Set formatters preserve the attribute order of the immutable relation snapshot
for display. This is presentation canonicalization only: it does not change the
API payload, infer dependencies or perform normalization work in the client.

The frontend may format sets, count violations and choose deterministic copy. It
must not discover keys, compute minimal covers, infer normal forms, synthesize or
decompose locally.

## Visual tokens

The visual direction is technical and editorial: dense enough for mathematical
work, generous enough to scan, neutral surfaces with one restrained accent.
Avoid gradients, glass, large shadows, oversized radii and nested cards.

Minimum token proposal:

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.75rem;

  --surface-page: /* warm or cool near-white */;
  --surface-raised: /* white */;
  --surface-subtle: /* quiet section fill */;
  --text-primary: /* near-black */;
  --text-secondary: /* muted, still AA */;
  --border-default: /* neutral divider */;
  --accent: /* restrained blue/teal */;
  --accent-strong: /* hover/active */;
  --status-success: /* dark green */;
  --status-danger: /* dark red */;
  --status-warning: /* dark amber */;
  --focus-ring: /* high-contrast accent */;
}
```

Use a modern system sans for UI and a restrained monospace stack only for
relation/FD notation. Borders and subtle surface changes establish hierarchy;
shadows are reserved for transient overlays. Semantic status always includes an
icon and word, never color alone.

## Accessibility contract

- Every input has a persistent `<label>` and errors are connected with
  `aria-describedby`; required state is announced.
- Native controls are preferred. Custom multi-selects follow the ARIA listbox
  pattern only after keyboard behavior is implemented and tested.
- Focus is visible at 3:1 against adjacent colors and is never removed.
- Pointer targets are at least approximately 44 by 44 CSS pixels on touch.
- Statuses include text and icon; decorative arrows/icons are hidden from
  assistive technology while equivalent text is available.
- Loading uses `aria-busy`; completion/error announcements use a polite live
  region. Focus moves only for validation errors or an explicitly opened panel,
  not automatically to results.
- Violation disclosures are buttons with `aria-expanded` and an associated
  region. The BCNF tree retains an ordered textual representation.
- Heading levels, landmarks (`header`, `main`, labeled sections) and DOM order
  match the mobile reading order; CSS columns do not scramble it.
- Contrast targets WCAG 2.2 AA. Reduced motion is naturally respected because
  the MVP uses no essential animation.
