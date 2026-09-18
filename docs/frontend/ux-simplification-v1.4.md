# SchemaWise UX Simplification v1.4

Status: **staging approved with the authenticated persisted-project Save smoke
deferred** (2026-09-17). See the
[staging audit](../testing/ux-simplification-v1.4-staging-audit.md).

## Product objective

The primary job is: when a person defines a relation and its functional
dependencies, they can quickly determine whether the schema is normalized,
understand why, and choose a transformation. V1.4 changes information
architecture and defaults; it does not add features, calculations, DTOs,
storage, authentication, or API behavior.

The governing principle is **simple by default, deep when requested**.

## Primary flow

```text
Input -> Analyze -> Analysis summary -> Issues -> optional explanation/diagram
      -> Transform -> compact result -> optional steps/reasoning/diagram
```

The analysis summary keeps the analyzed relation and currency, candidate keys,
prime attributes, 2NF/3NF/BCNF statuses, issue-causing dependencies, and the
minimal cover visible without opening a disclosure. It uses rows, notation and
dividers rather than cards, metrics, charts or a dashboard grid.

## Educational hierarchy

Each important result now has one contextual entry point:

```text
Result
└─ Explain
   ├─ Why this result
   ├─ Related concept
   └─ Formal reasoning (closed Level 3)
```

Candidate-key, prime-attribute and minimal-cover definitions are composed into
their result explanation from the existing concept source. The full 16-term
Concept Reference remains a closed native disclosure with a semantic `dl`.
`ConceptHelp` remains available for the Closure tool and other independently
useful contexts; the mathematical and educational content is not removed.

## Normal forms and issues

Normal forms are compact status rows. Satisfied-result prose, the 1NF
assumption and hierarchy explanation moved behind `Explain normal forms`.
Violation evidence is adjacent to those rows and visible at Level 1.

When one dependency violates more than one form, it renders once. For example,
`B -> C` is labeled `Violates 3NF and BCNF`, with separate 3NF and BCNF
reasoning inside one `Explain issue` disclosure. This preserves the distinct
rules while removing repeated Level 1 FDs. `Show in diagram` opens the existing
visualization in Analysis mode, selects evidence and focuses the opened panel.

## Visualization integration

The visualization remains closed by default and is now a compact `Diagram`
surface between analysis and transformations. It complements the textual
result. Existing Schema, Analysis and Transformations modes, composite
determinants, keys, violation selection, historical snapshots and transformation
evidence are retained.

Transformation result actions open Transformations mode and programmatically
focus the corresponding 3NF or BCNF diagram. No request, calculation or
persisted state is introduced by opening or switching a diagram.

## Transformations

Before execution, generation is primary inside its transformation context.
After success, `Run again` becomes a tertiary action and the result is primary:

- 3NF shows final relations, dependency preservation and lossless join first;
- BCNF shows final relations, step count and lossless join first;
- preservation shows the checked status and any lost dependencies first.

Provenance, minimal cover used, decomposition steps, preserved dependencies,
property distinctions and formal reasoning remain present behind contextual
disclosures. Completion copy remains in polite live regions without consuming
visual space.

## Layout and context

Desktop uses an approximately 34/66 input/results split. The input remains a
normal document (no nested scrolling and no tall sticky editor). Instead, the
small analyzed-relation header is sticky at widths above 1024px, keeping the
historical schema and `Current` / `Out of date` state visible while results are
read. Mobile keeps DOM and visual order as Input then Results; sticky behavior
is disabled.

The project bar retains Project name, state, New, Open, Save and authentication.
New/Open/auth are tertiary, Save is visible secondary, and Analyze remains the
global input primary action. Successful transformation reruns no longer compete
with their results.

## State and boundaries

All new open/mode/selection/focus behavior is local to `AnalysisResults` and
native disclosures. The workspace reducer, draft revision, dirty comparison,
server revision, Project Recovery, auth and persistence are unchanged. A stale
analysis continues to render its historical summary, explanations, diagrams
and transformations while the current draft stays in Input.

## Accessibility

- Native `details`/`summary`, buttons, lists, headings and definition lists.
- Formal reasoning is always closed by default and nested at Level 3.
- Essential evidence is never color-only.
- Educational interactions perform zero network requests.
- Programmatic focus is used only for explicit cross-surface actions such as
  `Show in diagram` and `View diagram`.
- Touch controls keep the existing 44px target baseline.
- Educational prose is capped at approximately 65 characters per line while
  mathematical output can use the available result width.

See the measured browser evidence in
[`ux-simplification-v1.4-audit.md`](../testing/ux-simplification-v1.4-audit.md).
