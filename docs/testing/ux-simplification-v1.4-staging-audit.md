# UX Simplification v1.4 staging audit

Date: 2026-09-17  
Environment: staging only  
Classification: **UX SIMPLIFICATION V1.4 STAGING: PASS WITH DEFERRED CHECKS**

This audit deployed and exercised the frozen UX Simplification v1.4 at
<https://schemawise-staging.vercel.app>. It did not create a tag, deploy the
SchemaWise production product, manually redeploy or modify Render, access or
modify Neon, change secrets, or change backend product code.

## Revisions and deployment

| Component | Revision | Evidence |
| --- | --- | --- |
| Source | `8e7161e2e130e5690aa59165d926cfd806d43a9e` | clean three-commit v1.4 source pushed to `master` |
| Vercel staging application | `8e7161e2e130e5690aa59165d926cfd806d43a9e` | `dpl_Ethq4ZV2nAnsHCLHxDeYmj6XXAEr`, READY, public staging alias attached |
| Render staging API | `635d41774b6acb939d6b09cb317b6ea1153645fc` | previously approved live deployment, intentionally unchanged |

The Vercel build cloned `8e7161e`, used the project's Node 22.x runtime and
Vite 7.3.6, transformed 79 modules and completed the build/deployment. The
artifact contains one Node Function, `api/proxy`. The public alias and the
Git-master alias point at the READY deployment. The ordered API rewrite and SPA
fallback remained functional.

## Pre-push and service smoke

The initial worktree was clean. The diff from `origin/master` contained only
`apps/web` source/styles/tests and frontend/architecture/testing documentation.
It contained no productive `apps/api` file, migration, secret, Vercel/Render/
Neon configuration, or backend change.

- `npm run typecheck`: PASS in API, Web and Engine.
- `npm test`: PASS, 43 files / 493 tests (API 140, Web 179, Engine 174).
- `npm run build`: PASS; Vite transformed 79 modules.
- `npm run test --workspace @schemawise/web`: PASS, 18 files / 179 tests.
- `git diff --check`: PASS.
- `npm audit --omit=dev`: PASS, 0 vulnerabilities.
- Direct Render `GET /health`: 200, `{"status":"ok"}`.
- Direct Render `GET /ready`: 200, `{"status":"ready"}`.
- Vercel `POST /api/v1/analysis`: 200 JSON for `R(A,B,C)`, `A -> B`,
  `B -> C`; candidate key `{A}`, 2NF true, 3NF false and BCNF false.
- The proxied response exposed the Render origin/request headers through the
  Vercel response, while a direct project deep link returned the SPA HTML 200.

No Render redeploy or Neon/migration action was required because the productive
API diff is empty. It is expected and correct that Render remains at its prior
SHA.

## First-time-user test and information architecture

The browser was opened as an anonymous first-time visitor and help remained
closed until after the default state was assessed. `Load example` creates the
required Case A, and the input labels explain relation, attributes and
functional dependencies. `Analyze schema` is the only strong global editor
action.

Without opening help, the UI directly answered all requested questions:

1. Input is a named relation, its attributes and functional dependencies.
2. `Analyze schema` is at the end of the editor.
3. Candidate key: `{A}`.
4. Prime attributes: `{A}`.
5. 2NF: satisfied.
6. 3NF: violated.
7. BCNF: violated.
8. `B -> C` causes both violations.
9. `Explain issue` provides the contextual explanation.
10. `Show in diagram` and the compact `Diagram` surface provide visualization.
11. 3NF and BCNF actions are under `Transformations`.

The perceived reading order was Summary (key facts and normal-form rows),
Issues, minimal cover, Visualization, Transformations and Concept Reference.
The ordering was confirmed visually and through increasing DOM geometry, not
only source order. No discovery friction or competing parallel help path was
found.

## Default analyzed state and summary

The default Case A state displays `R(A,B,C)`, `Current`, candidate keys, prime
attributes, 2NF/3NF/BCNF, minimal cover, the single issue, Explain, Diagram and
both transformation actions without opening a disclosure. All 16 native
details elements in the complete editor/result document were closed after
Analyze.

The summary is a compact reading surface rather than a dashboard. Its two key
facts align in a row on desktop, normal forms are three short rows, the issue is
adjacent to their status, and mathematical output remains distinguishable from
labels. The result is understandable without help.

## Educational hierarchy and concept help

The deployed hierarchy is Result -> Explain -> Formal reasoning. `Explain
issue` contains separate 3NF and BCNF reasons under one Level 1 dependency;
both Formal reasoning disclosures start closed. The candidate-key Explain
contains one secondary `Related concept` definition in context. There is no
parallel `What is...?` trigger competing with analysis results.

Formal reasoning presents Rule, Evidence and Conclusion and does not repeat a
second complete Level 2 surface. Its measured content width was approximately
369px at 1280 and 420px at 1440, capped by the 65ch educational container, so
lines never expanded across the full Results column.

## Normal forms and violation deduplication

The default rows report 2NF Satisfied, 3NF Violated and BCNF Violated. The 1NF
assumption and hierarchy material are secondary under `Explain normal forms`.
Case A renders exactly one issue row, `B -> C — Violates 3NF and BCNF`, while
retaining independent 3NF and BCNF formal rules inside its explanation.

`Show in diagram` opened Visualization, selected Analysis mode, selected
`B -> C`, announced `3NF evidence: determinant {B}; dependent C`, moved focus
to the diagram content and generated zero requests.

## Visualization integration and regression

Visualization is a compact closed `Diagram` surface between analysis and
transformations. It reads as supporting evidence rather than a second product.
Schema, Analysis and Transformations modes remain available. Opening, changing
mode and selecting evidence use existing DTO state and do not call the API.

The Case A `A -> B`, `B -> C` selection passed. A separate 390px composite
smoke rendered `AB -> C` as one determinant `{A,B}`, one dependent `{C}` and
the complete accessible sentence “A, B functionally determines C.” There was
no horizontal overflow. Transformation diagrams remained reachable from the
generated results; the full v1.3 mathematical audit was not repeated.

## Transformations

Before generation, `Generate 3NF synthesis` and `Generate BCNF decomposition`
are clear primary actions within their own contexts. After success, each action
becomes the quiet `Run again`; the result surface dominates.

The default 3NF result exposed `{A,B}`, `{B,C}`, Dependency preserving and
Lossless join without Explain. Explain then exposed provenance, the minimal
cover, guarantees and closed formal reasoning. The diagram was not repeated as
a second textual result.

The default BCNF result exposed final relations `{A,B}`, `{B,C}`, one
decomposition step and Lossless join. Detailed steps and Explain were closed.
Opening steps showed the single `R(A,B,C)` / `B -> C` split. Dependency
preservation returned `Preserved`; the complete preserved-dependency evidence
and reasoning remained secondary.

With both transformations generated and optional parent disclosures closed,
Results measured 1,857px and Transformations 945px at 1440px, matching the
local v1.4 audit. The default did not return to the pre-simplification expanded
page.

## Concept Reference, Closure and project bar

`Concept reference 16 concepts` was closed and compact by default. Enter opened
16 `dt`/16 `dd` pairs; Space closed it again and restored compactness. Both
operations generated zero requests.

`Tools` was closed by default. Enter opened the functioning Attribute closure
controls without competing with Analyze. Mathematical correctness was not
re-audited.

The project bar retained Project name, Saved/Unsaved status, New, Open, Save
and Sign in. Save remains visible but secondary, New/Open/auth are quiet, and
Analyze remains the editor primary.

## Desktop, sticky and mobile

At 1280x800 and 1440x900, the browser-rendered grid visually retained the
approximately 34/66 Input/Results split. Results had the wider reading column;
Input remained usable with no nested scroll or abandoned half-screen. No layout
jump was observed.

Above 1024px, the 107px analysis header used `position: sticky; top: 0` and
remained at viewport top while the document scrolled. It did not overlap the
site header, create a nested scroller, jitter, trap keyboard focus or make
content inaccessible. At 320, 360 and 390px it was static.

| Viewport | Full page | Results | Horizontal overflow | Sticky |
| --- | ---: | ---: | --- | --- |
| 320x720 | 4,387px | 1,523px | none | off |
| 360x800 | 4,326px | 1,523px | none | off |
| 390x844 | 4,265px | 1,504px | none | off |
| 1280x800 | 2,281px | 1,114px | none | on |
| 1440x900 | 2,261px | 1,114px | none | on |

The mobile reading flow was Input -> Summary -> Issues -> optional details ->
Visualization -> Transformations. No rendered button or summary measured below
40 CSS px in the tested states; the existing touch baseline, text wrapping,
Explain/Formal reasoning and Diagram remained usable.

## Staging metrics

| Metric | Old baseline | Local v1.4 | Staging v1.4 | vs old |
| --- | ---: | ---: | ---: | ---: |
| Results, 1440x900 | 1,750px | 1,114px | 1,114px | -36.3% |
| Results, 390x844 | 2,199px | 1,504px | 1,504px | -31.6% |
| Full page, 390x844 | 5,050px | 4,307px | 4,265px | -15.5% |

The 42px full-page difference from local is less than 1% and is attributable to
live browser text/layout geometry; the Results metric is effectively identical
and the difference improves rather than undermines compactness.

## Copy, stale snapshots and network

No visually redundant “Analysis complete” or transformation-complete heading
was present; those strings remained correctly hidden in polite live regions.
No repeated visible heading, dominant disclaimer, duplicate explanation or
unnecessary Level 1 technical label was found.

Renaming A to `Changed A` immediately displayed `Out of date` and an explicit
stale notice. Input used `Changed A`; Summary, Analysis diagram and generated
transformations remained historical `R(A,B,C)`. 3NF/BCNF reruns and preservation
were disabled, while historical `View diagram` remained available. Snapshots
were not mixed.

Opening/closing Explain, Formal reasoning, Concept Reference and Visualization,
changing diagram mode, and Show in diagram generated exactly zero fetch/XHR
requests. Only Analyze, Synthesis, BCNF and Preservation contacted the API.

## Accessibility, axe and console

Native summaries were exercised with Enter and Space and retained focus.
Tab moved from candidate-key Formal reasoning to prime-attribute Explain;
Shift+Tab returned to Formal reasoning. Show in diagram moved focus to the
requested diagram. Mouse was not required.

Axe-core 4.13.0 ran with color contrast enabled:

| State | Violations | Incomplete |
| --- | ---: | --- |
| Default analyzed | 0 | `color-contrast`, 2 nodes |
| Explain open | 0 | `color-contrast`, 2 nodes |
| Formal reasoning open | 0 | `color-contrast`, 2 nodes |
| Visualization open | 0 | `color-contrast`, 4 nodes |
| 3NF result | 0 | `color-contrast`, 4 nodes |
| BCNF result | 0 | `color-contrast`, 4 nodes |
| Concept Reference open | 0 | `color-contrast`, 4 nodes |

The incomplete nodes were axe's inability to calculate contrast for the
decorative dependency arrow, satisfied check, disclosure glyph and diagram
connector; the relevant glyphs are `aria-hidden`. No rule was excluded and no
text-contrast violation was reported.

Chrome reported no React/router warning, duplicate key, ResizeObserver loop,
unhandled promise, failed asset, proxy failure or exposed secret. The sole
console error was the expected anonymous `/api/v1/auth/me` 401. A Vercel
error-level log query returned no logs for the deployed staging artifact.

## Project Recovery regression

A direct `/projects/<uuid>` URL and refresh both returned the SPA and the safe
anonymous sign-in state. Root editor dirty state, unknown-route navigation and
Back/Forward routing remained functional. The unchanged Project Recovery test
suite passed.

Authenticated persisted-project Save was not repeated because no controlled
credential was available and creating/updating a project would write Neon,
which this release explicitly forbids. The approved v1.2 staging audit remains
the evidence for that persisted flow; no project/auth/persistence source changed.

## Issues, fixes and final result

No Critical, High, Medium or actionable Low v1.4 issue was found. No source fix
or additional design change was justified. The only repository change after
the audit is this staging evidence and the frontend status precision.

**UX SIMPLIFICATION V1.4 STAGING: PASS WITH DEFERRED CHECKS**

Deferred: authenticated persisted-project Save only, to honor the no-Neon-write
constraint. Next step is the integral final evaluation of SchemaWise as a
product and portfolio piece. Do not implement another feature and do not deploy
production.
