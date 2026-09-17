# Schema Visualization v1.3 audit

- Date: 2026-09-17
- Classification: **SCHEMA VISUALIZATION V1.3: FROZEN**
- Scope: local implementation and browser audit; no push or deploy

## Architecture and contract audit

Reviewed before implementation:

- `apps/web/src/features/workspace/` components, reducer, formatters and tests;
- `apps/web/src/features/explanations/` content/builders/tests;
- `apps/web/src/api/schemawise-contracts.ts` and the matching OpenAPI schemas;
- `apps/web/src/styles.css`;
- Educational UX, content model, component model and frontend architecture docs.

Confirmed response evidence:

- `AnalysisResponseDto`: returned relation, candidate keys, prime attributes, minimal cover and 2NF/3NF/BCNF diagnostics.
- 2NF violation: candidate key, determinant and dependent ID.
- 3NF/BCNF violation: determinant and dependent ID.
- 3NF synthesis: relations with `minimal-cover | candidate-key` source, minimal cover and optional added candidate key.
- BCNF decomposition: final relations and ordered steps containing source, exact violation and two results.
- Preservation: checked boolean plus preserved and lost dependencies; no responsible-leaf field.

The editor accepts multi-attribute RHS values. The visualization therefore distinguishes exact draft input from analyzed evidence and does not assume that draft FDs are in minimal-cover form.

## Rendering decision

ADR 018 selects semantic HTML/CSS instead of React Flow, custom SVG or another layout dependency. Reasons: six-attribute limit, composite determinant correctness, accessible native interaction, deterministic tests, mobile reflow and zero bundle dependency. Dependency rails retain a set-valued LHS/RHS.

## Model verification

Pure builder tests cover:

- Case A `A→B`, `B→C`;
- Case B `{A,B}→C`, `C→B`;
- composite-key 2NF evidence;
- multiple candidate keys and prime attributes;
- multi-step BCNF order;
- lost dependency evidence;
- `∅→A`;
- no FDs;
- 120-character labels;
- synthesis source provenance.

The correctness gate asserts independently that the model contains neither `A→C` nor `B→C` for `{A,B}→C`.

## Accessibility verification

- Named diagram regions and relation labels.
- Same-DOM textual equivalents for arrows and composite/empty determinants.
- Native buttons for mode, key, violation and BCNF-step selection.
- Keyboard activation and `aria-pressed` selected state.
- Visible text for Key, Prime, Determinant, Dependent and Lost dependency roles; color is supplemental.
- Full long-label DOM text plus wrapping and `title`.
- axe-core: zero automated violations in the rendered visualization surface (color contrast disabled in jsdom, inspected in browser).

## Stale verification

Component coverage renders a renamed current draft alongside an old analyzed snapshot. Schema mode uses the new name; Analysis mode retains the historical name and stale notice. Transformations receive only the analyzed snapshot.

## Browser verification

Local Chromium through `agent-browser`, Vite and the real stateless API routes:

- Case A: two distinct dependency rails, no crossings.
- Case B: determinant labels were exactly `{A, B}` and `{C}`; no split false FDs.
- Empty determinant: visible `∅` and spoken equivalent “the empty set functionally determines A”.
- BCNF multi-step: two DTO steps rendered; Step 2 selected with keyboard Enter and only one `aria-pressed=true`.
- Lost dependency: `Not preserved` and `{A,B}→C` highlighted without assigning a leaf.
- 3NF synthesis: three result nodes in a fan-out, distinct from BCNF splits.

Viewport checks:

| Viewport | Page overflow | Result |
| --- | --- | --- |
| 320×720 | No | Pass |
| 360×800 | No | Pass |
| 390×844 | No | Pass |
| 768×1024 | No | Pass |
| 1280×800 | No | Pass |
| 1440×900 | No | Pass |

No Vite error overlay, page errors, console errors or `ResizeObserver` loop was observed.

## Visual audit

- The diagram adds a compact visual scan without replacing the textual result.
- FD rails avoid crossings and keep composite determinants visually atomic.
- Relation containers, determinant/dependent labels and evidence tags are distinct.
- 3NF fan-out and BCNF split sequence use different structures.
- Mobile controls and BCNF results stack vertically without required pan/zoom.
- The editorial neutral surface, small radii and restrained status colors remain consistent with SchemaWise.

## Issues found and resolved

1. **Medium — Educational keyboard order regression.** Initial placement put `Visualize schema` before Candidate Keys and broke a v1.1 focus-order test. Resolved by placing the secondary visualization after textual violation evidence.
2. **Medium — 2NF key emphasis incomplete.** Initial selection emphasized the partial determinant/dependent but only stated the full candidate key in text. Resolved by marking every returned candidate-key attribute while preserving determinant/dependent roles.

No Critical, High or Medium issue remains open.

## No-recomputation audit

Search and code review found no engine import or implementation of closure, superkey search, candidate-key discovery, prime calculation, minimal cover, normal-form evaluation, projection, synthesis, BCNF decomposition, preservation, `F+` or lossless join. Builders only map, label, test membership and compare one source attribute set to the original for presentation.

## Final validation

- `npm run typecheck`: pass, 3 workspaces.
- `npm test`: pass, 43 files / 491 tests total:
  - API: 10 files / 140 tests;
  - Web: 18 files / 177 tests;
  - normalization engine: 15 files / 174 tests.
- `npm run build`: pass, 3 workspaces; Vite transformed 79 modules.
- `npm run test --workspace @schemawise/web`: pass, 18 files / 177 tests.
- `git diff --check`: pass.
- `npm audit --omit=dev`: 0 vulnerabilities.
