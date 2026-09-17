# Schema Visualization v1.3 staging audit

Date: 2026-09-17  
Environment: staging only  
Classification: **SCHEMA VISUALIZATION V1.3 STAGING: PASS WITH DEFERRED CHECKS**

This audit deployed and exercised Schema Visualization v1.3 at
<https://schemawise-staging.vercel.app>. It did not deploy production, create a
tag, redeploy or modify Render, access or modify Neon, change secrets, or change
backend product code.

## Revisions and deployment

| Component | Revision | Evidence |
| --- | --- | --- |
| Audited source/application | `04c759f130160bcb0794ccd1581babf78b7f005e` | staging fix commit after the first browser pass |
| Vercel application deployment | `04c759f130160bcb0794ccd1581babf78b7f005e` | deployment `dpl_4E4gHD3SkQmJ2FfMfZSD4kd8BSCU`, READY, public alias attached |
| Render | `635d41774b6acb939d6b09cb317b6ea1153645fc` | existing live deployment, intentionally unchanged |

The initial frozen source `984a86abd427925abcd48b44354ca0015ee79290`
also auto-deployed successfully before the staging finding was fixed. The final
Vercel build cloned `04c759f`, used Vite 7.3.6 and Node 22.x, transformed 79
modules, completed the Vite build and deployment, and reported one Node
Function. The public alias was updated. The deployed rewrite order remains:

1. `/api/v1/(.*) -> /api/proxy`
2. `/(.*) -> /index.html`

The full Vercel install reported two moderate development-dependency findings;
the required runtime gate `npm audit --omit=dev` reported zero vulnerabilities.

## Pre-push and service regression

The original three-commit diff contained only `apps/web` source/tests/styles
and frontend/testing/architecture documentation. It contained no productive
`apps/api` file, migration, secret, package/deployment configuration, Render
change or Neon change. The initial worktree was clean.

- Direct Render `GET /health`: 200, `{"status":"ok"}`.
- Direct Render `GET /ready`: 200, `{"status":"ready"}`.
- Vercel `POST /api/v1/analysis`: 200 JSON for `R(A,B,C)`, `A -> B`,
  `B -> C`; candidate key `{A}`, 2NF true, 3NF false and BCNF false.
- The analysis response included `x-render-origin-server: Render` and a Render
  request ID, proving `/api/v1/*` used the Function proxy rather than the SPA
  fallback.
- A direct `/projects/<uuid>` refresh returned the SPA document as HTML 200.
- No Vercel runtime error cluster, error log or warning log was reported for the
  final deployment during the audit window.

## Browser and method

The live alias was exercised with Google Chrome 153.0.8010.47 through
Playwright Core 1.63.0. Evidence came from actual clicks, keyboard input, touch
events, accessibility snapshots, screenshots, DOM/layout measurements,
captured requests/responses, console/page-error capture and axe-core 4.13.0.
No color-contrast rule was excluded.

## Discovery and visual hierarchy

For Case A, `Visualize schema` appeared after textual violation evidence and
before transformation actions. It was collapsed by default, compact, clearly
labeled as a diagram, and stated that it presents existing evidence rather
than calculating normalization. The textual Analysis, Why?, Formal reasoning,
Concept Help and glossary remained the primary explanatory flow. The diagram
did not dominate Results at desktop or phone widths.

## Schema mode and dependency semantics

- Case A rendered relation `R`, attributes A/B/C, and separate `A -> B` and
  `B -> C` rails. Determinant/dependent labels, arrow direction and hidden
  spoken equivalents were unambiguous.
- Critical composite case `AB -> C`, `C -> B`: `{A,B} -> C` rendered as one
  rail with one determinant node, one dependent node and the accessible text
  “A, B functionally determines C.” It never rendered or announced `A -> C`
  or `B -> C`.
- Empty determinant `∅ -> A`: `∅` was visible in the determinant node and its
  accessible equivalent said “the empty set functionally determines A.” It
  remained legible at 390x844 with no mystery/empty node.
- Multi-RHS `A -> {B,C}` remained one entered dependency and one diagram rail
  with a single dependent set `{B,C}`. The analysis DTO correctly returned a
  singleton minimal cover without rewriting Schema mode.
- No-FD Schema and Analysis modes explicitly said that no dependencies were
  available; the Analysis control said no violations were returned.

## Analysis evidence

- Case A candidate key `{A}` selected with `aria-pressed=true`; A showed
  `Key · Prime`, while B/C were visually subdued without losing text contrast.
- Case B returned composite keys `{A,C}` and `{A,B}`. Selecting a composite key
  emphasized both members, subdued only the outside attribute and retained a
  visible `Prime` label on all prime attributes. Candidate key, prime attribute
  and primary key were not conflated.
- Real 2NF case `R(A,B,C), A -> C` returned candidate key `{A,B}` and a partial
  dependency. `Show in diagram` selected the exact FD, highlighted both A and B
  as the complete key, A as determinant and C as dependent, and printed the
  same evidence summary.
- Case A 3NF selection showed exactly determinant B, dependent C and `B -> C`.
- Case B BCNF selection showed exactly determinant C, dependent B and `C -> B`.
  The display did not apply the 3NF prime exception as a BCNF criterion.
- Text-to-diagram actions and diagram controls shared selection state; Enter,
  Space, pointer clicks and touch taps produced the expected pressed state.

## Transformations and preservation

- Case A 3NF synthesis displayed the original relation and a fan-out to
  `{A,B}` and `{B,C}`, both labeled from the minimal-cover source. It did not
  imply that one FD causally created a relation or resemble a BCNF split tree.
- The real partial-dependency case `A -> C` produced `{A,C}` as
  `Minimal-cover source` and the added `{A,B}` relation as
  `Candidate-key source`.
- BCNF rendered ordered response steps with source, violating FD and two
  results. The four-attribute chain `A -> B`, `B -> C`, `C -> D` produced two
  real steps. Selecting step 2 left only step 2 pressed/emphasized, by keyboard
  and touch.
- The explicit headings/copy make synthesis (one fan-out) and BCNF (ordered
  splits) visually and conceptually distinct.
- Case A preservation returned `Preserved`.
- Case B preservation returned `Not preserved` and highlighted lost dependency
  `AB -> C`. The UI did not assign it to a leaf, call it data loss, or confuse
  it with the separately stated lossless-join guarantee.

## Stale snapshots and empty states

After Case A analysis and transformations, attribute A was renamed to
`Current A`. Schema mode immediately used `Current A`; Analysis and both
transformation diagrams retained historical A. `Out of date` and the exact
historical relation notice were visible. No snapshot labels were mixed.

The live surface gave explicit explanations for analysis not run, no
attributes, no FDs, no violations, no generated transformations and
preservation not checked. A relation with no attributes cannot be analyzed by
the valid-input flow, so its empty state remains the editor/results explanation
rather than an empty visualization canvas.

## Long labels and responsive behavior

Relation and attribute labels near the 120-character limit retained their full
DOM/accessibility names and `title`, wrapped at arbitrary characters and had
equal client/scroll dimensions. At 320 px the layout became very tall, as
expected, but remained readable and operable with no clipping or horizontal
page overflow.

Measured viewports were `320x720`, `360x800`, `390x844`, `768x1024`,
`1280x800` and `1440x900`. Schema, composite Schema, Analysis, combined
Synthesis/BCNF, multi-step BCNF and lost-dependency Preservation all reported
`scrollWidth === clientWidth` at every size. No visualization control measured
below 40 CSS px in its rendered state. Mobile used a clear vertical reading
order and required no zoom or pan.

## Accessibility and axe

The visualization region, diagram modes, relation, dependency groups,
candidate-key controls, violation controls, legend and transformation regions
had accessible names. Connectors were decorative; complete dependency/split
sentences remained in the accessibility tree. Native buttons exposed expanded
and pressed state. Tab, Shift+Tab, Enter and Space were exercised, along with
touch taps for a composite key and BCNF step.

The first staging pass found one Medium issue:

- muted attributes used `opacity: 0.42`, which could reduce role/name text to
  1.9:1 during selection changes; axe also marked labeled `div` containers
  without a compatible role as incomplete.

Commit `04c759f` replaced opacity-based muting with a subdued surface/border
that preserves text contrast and added `role="group"` to the labeled
containers. Final axe results were **0 violations** in every required state:
Schema, Analysis, candidate key selected, violation selected, 3NF
Synthesis/BCNF, Preservation, composite FD, empty determinant, multi-RHS, 2NF,
multi-step BCNF and empty states. The prior `aria-prohibited-attr` incomplete
results were eliminated.

Exact final incomplete results were one `color-contrast` rule only:

| State | Incomplete nodes |
| --- | ---: |
| Case A Schema | 5 |
| Case A candidate key | 5 |
| Case A violation | 4 |
| Case A transformations | 6 |
| Composite Schema | 6 |
| Composite BCNF violation | 5 |
| Composite Preservation | 7 |
| Empty determinant | 3 |
| Multi-RHS | 6 |
| 2NF selection | 3 |
| Multi-step BCNF | 7 |
| Empty states | 6 |

These were axe's inability to calculate contrast for `aria-hidden` arrows,
check/minus glyphs and connector/branch line art, plus the one-character `∅`.
No failing text contrast remained and no rule was disabled.

## Network, recomputation and Educational UX

Switching Schema/Analysis/Transformations, selecting a candidate key,
selecting a violation and selecting a BCNF step produced zero fetch/XHR
requests. The only operation requests were the explicit Analysis, Synthesis,
BCNF and Preservation actions. Source review confirms that the visualization
maps existing draft/DTO state and contains no Closure, Analysis, candidate-key,
Synthesis, BCNF or Preservation computation/call.

Opening Why?, Formal reasoning, Concept Help and the glossary generated zero
requests. They remained reachable and visible around the visualization. Their
copy and hierarchy were unchanged.

## Console and Project Recovery regression

There were no React/key warnings, ResizeObserver loops, layout exceptions,
unhandled promises, failed assets, proxy failures or exposed secrets. Fresh
anonymous loads produced the expected `/api/v1/auth/me` 401; Chrome reports
that response as a failed-resource console line, but it is the designed
anonymous-session probe and returned JSON through the proxy.

The public deep-link fallback, API proxy, route document and the unchanged
Project Recovery local suites passed. A real persisted-project edit/Save smoke
was not repeated: no authenticated staging project/credential was available in
this workspace, and creating or updating one would write Neon, explicitly out
of scope for this audit. The complete v1.2 persisted-project staging audit
remains approved and no project/auth persistence code changed in the staging
fix.

## Validations, issues and final result

- `npm run typecheck`: PASS.
- `npm test`: PASS, 43 test files / 491 tests (API 140, Web 177, Engine 174).
- `npm run build`: PASS; Vite transformed 79 modules.
- `npm run test --workspace @schemawise/web`: PASS, 18 files / 177 tests.
- `git diff --check`: PASS.
- `npm audit --omit=dev`: PASS, 0 vulnerabilities.
- Medium contrast/ARIA finding: fixed in `04c759f` and reverified on staging.
- Critical/High findings: none.
- Deferred: authenticated persisted-project edit/Save/Back/Forward smoke only,
  to honor the no-Neon-mutation constraint.

**SCHEMA VISUALIZATION V1.3 STAGING: PASS WITH DEFERRED CHECKS**

Next step: close Schema Visualization v1.3 and re-evaluate the complete product
before choosing another feature. Do not deploy production.
