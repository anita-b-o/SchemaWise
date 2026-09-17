# SchemaWise schema visualization v1.3

## Product intent

Schema visualization is a secondary representation of evidence already known by SchemaWise. The existing Educational UX remains the explanatory source of truth. Analysis and transformations do not depend on diagram rendering.

The surface is opened with `Visualize schema` inside Analysis results and offers three compact modes:

1. **Schema** — current draft relation, attributes and explicit input FDs.
2. **Analysis** — immutable analyzed snapshot, returned candidate keys/prime attributes and selectable violation evidence.
3. **Transformations** — generated 3NF synthesis, generated BCNF split sequence and checked dependency preservation.

## Functional dependencies

Every FD is one semantic dependency rail:

```text
Determinant {A, B} ───▶ Dependent {C}
```

The determinant node is the whole set. The UI never emits `A → C` or `B → C` for `{A,B} → C`. `∅` is a visible determinant. Schema mode preserves a multi-attribute input RHS; analysis violation evidence remains the exact DTO dependency.

## Analysis evidence

- Candidate-key buttons use `candidateKeys`; selecting one emphasizes exactly those attributes and subdues the others with surface/border treatment while preserving text contrast.
- Prime labels use `primeAttributes` and include visible text, not color alone.
- 2NF selection shows candidate key, partial determinant and dependent non-prime attribute from one `SecondNormalFormViolationDto`.
- 3NF and BCNF selection show determinant, dependent and diagnosed FD from their violation DTO.
- `Show in diagram` in textual violation details and the diagram's violation controls share one UI-local selection ID.

## Transformations

3NF synthesis is a fan-out from the original relation to the returned relation set. Relation source labels come from `SynthesizedRelationDto.source`; the UI does not claim that an individual FD created a relation.

BCNF is an ordered sequence of selectable split records. Each step shows only its returned source, violating FD and two returned relations. The view does not reconstruct a hidden derivation tree.

Dependency preservation displays the observed `Preserved`/`Not preserved` response. Returned `lostDependencies` are emphasized, without assigning a responsible leaf. Copy explicitly distinguishes lost dependency from lost data and lossless join from dependency preservation.

## Accessibility and responsive behavior

- Labeled semantic sections/groups and a full textual equivalent are part of the same DOM.
- Native buttons provide keyboard, mouse and touch selection with `aria-pressed`.
- Decorative connectors are hidden from assistive technology.
- Full attribute names remain DOM text and wrap at arbitrary characters; no essential label is available only through hover.
- At 35rem and below, controls become full-width, relations use two/one-column flow as appropriate, and BCNF branches stack vertically.
- No pan, zoom, canvas, WebGL or essential animation is used.
- The only transition is cosmetic node emphasis and is disabled under `prefers-reduced-motion: reduce`.

## Empty states

The existing Results placeholder covers analysis not yet run. Diagram modes explicitly cover no attributes, no FDs, no violations, no generated transformations, no BCNF steps and preservation not checked.
