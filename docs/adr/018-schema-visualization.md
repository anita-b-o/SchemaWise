# ADR 018: Schema visualization rendering strategy

- Status: Accepted
- Date: 2026-09-17

## Context

SchemaWise v1.3 needs deterministic, accessible diagrams for relations, functional dependencies, analysis evidence and normalization transformations. The product limit is six attributes and twelve entered dependencies. A functional dependency with a composite determinant must remain one dependency: `{A,B} → C` cannot be rendered as `A → C` plus `B → C`.

The visualization is presentation over API DTOs and immutable operation snapshots. It is not allowed to calculate closures, keys, covers, projections, normal forms, decompositions or preservation.

## Options considered

| Option | Accessibility and keyboard | Layout and mobile | Determinism/testing | Composite determinants | Cost |
| --- | --- | --- | --- | --- | --- |
| React Flow / `@xyflow/react` | Requires substantial custom semantics beyond the visual canvas | Strong pan/zoom, but unnecessary for six nodes and can make mobile comprehension depend on a viewport | More runtime/layout behavior to stabilize | Possible with custom group nodes | Largest bundle and maintenance surface |
| Custom SVG | Accessible only with a parallel textual structure and careful focus handling | Coordinate and long-label reflow logic would be bespoke | Deterministic if fully controlled | Possible with determinant hubs | Medium implementation cost; label wrapping is awkward |
| Semantic HTML/CSS with connector glyphs | Native buttons, lists, headings and reflow; the DOM is the textual equivalent | Natural vertical reflow with no required pan/zoom | Stable DOM and straightforward unit/component tests | One determinant node owns the entire LHS set | No dependency; smallest maintenance surface |
| Small graph/layout library | Still needs a semantic overlay | Adds generalized layout for a bounded problem | Depends on library output | Library-specific | Unjustified dependency |

## Decision

Use semantic HTML/CSS dependency rails and transformation nodes. Connector glyphs are decorative and hidden from assistive technology; each relation, dependency, split and status has equivalent DOM text. Interactive choices are native buttons with `aria-pressed`.

Each `DiagramDependency` has one `left` attribute set and one `right` attribute set. The renderer creates one determinant node for the entire `left`, including `∅`, and never expands it into pairwise edges. Input dependencies keep multi-attribute RHS values intact. Analysis violations use the exact singleton dependent supplied by the corresponding violation DTO.

3NF is rendered as one synthesis fan-out. BCNF is rendered as the ordered sequence of split records supplied by `steps`; it is not reconstructed by mathematical analysis. Exact attribute-set equality is used only to label the original BCNF source.

## Consequences

- No runtime graph dependency or bundle increase.
- Mobile uses normal document flow; no horizontal zoom is required for normal cases.
- Long labels wrap and retain their complete DOM text and `title`.
- Future capture/export can serialize the HTML surface, but pixel-perfect SVG export remains out of scope.
- The design favors mathematical clarity over free-form node dragging or automatic graph routing.
