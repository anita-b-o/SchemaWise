# UX Simplification v1.4 audit

- Date: 2026-09-17
- Scope: local implementation and real Chromium audit; no push or deploy
- Case A: `R(A,B,C)`, `A->B`, `B->C`

## Baseline audit

At 1440x900, the default analyzed document was 2,392px high and the Results
article was 1,750px high. Results contained 9 headings, 7 section surfaces and
13 native details elements. Candidate keys, prime attributes and minimal cover
each exposed separate concept-help and result-help triggers. The same `B->C`
evidence appeared independently under 3NF and BCNF when both groups were
opened. Visualization was a large additional surface, and generated
transformations repeated relations, guarantees and evidence between the
diagram and textual sections.

At 390x844, the default page was 5,050px high and Results was 2,199px high.
Results began at 2,819px after the complete editor. The desktop left column
ended before the expanded result flow, leaving an unhelpful blank region.

The baseline exposed 11 competing education/diagram triggers in the analysis
flow (four concept-help buttons, candidate/prime/minimal explanations, two
normal-form violation groups, diagram and glossary). Save, Analyze and both
transformation actions also used the same strong green hierarchy.

## Implemented information architecture

The default order is analyzed relation/currency, key facts, normal-form rows,
deduplicated issues, minimal cover, optional diagram, transformations and a
closed glossary. A user can identify the candidate key, 3NF result and causing
FD without opening anything.

Case A now exposes one issue row: `B->C — Violates 3NF and BCNF`. Its single
Explain disclosure retains two rule-specific explanations and two independent
formal-reasoning disclosures. Candidate keys, prime attributes, normal forms,
minimal cover and each transformation similarly have one contextual Explain
entry.

## Before / after metrics

Measured from Chromium DOM geometry with every disclosure closed:

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Results height, 1440x900 | 1,750px | 1,114px | -36.3% |
| Full page height, 1440x900 | 2,392px | 2,261px | -5.5% |
| Results height, 390x844 | 2,199px | 1,504px | -31.6% |
| Full page height, 390x844 | 5,050px | 4,307px | -14.7% |
| Competing Level 1 education/diagram triggers | 11 | 7 | -36.4% |
| Open disclosures after Analyze | 0 | 0 | unchanged |
| Unique Case A issue rows | duplicated by 3NF/BCNF group | 1 | deduplicated |

The full desktop page reduction is smaller than the Results reduction because
the editor becomes the taller grid column; no input capability was hidden to
inflate the metric. The target of a 30–50% shorter essential Results flow is
met at both measured sizes.

After both transformations are generated at 1440px, Results is 1,857px high
and the Transformations section is 945px with every optional detail closed.
The previous fully explored baseline reached 5,486px after education,
visualization, glossary and transformations were opened simultaneously.

## Browser scenarios

- Case A: `{A}` key; 2NF satisfied; one deduplicated `B->C` issue for 3NF/BCNF.
- Case B (`AB->C`, `C->B`): keys `{A,B}` and `{A,C}`; every attribute prime;
  3NF satisfied and BCNF violated by `C->B`.
- Case C (`A->B` over `R(A,B,C)`): composite key `{A,C}`; `A->B` appears once
  and is labeled as violating 2NF, 3NF and BCNF.
- Case E (Case B BCNF decomposition): final `{B,C}` and `{A,C}`; lossless
  one-step decomposition; dependency preservation checked as `Not preserved`
  with lost `A,B->C`.
- Empty determinant: `∅->A` remained visible in Input, Minimal Cover and issue
  evidence with its accessible spoken equivalent.
- No violations: `R(A,B)` with `A->B` reported all three forms satisfied, no
  Issues block and no Transformations section.
- Long labels: a 120-character attribute remained complete in summary and
  diagram at 320px with zero horizontal overflow.

## Viewports

Case A default, real Chromium:

| Viewport | Page height | Results height | Horizontal overflow | Sticky header |
| --- | ---: | ---: | ---: | --- |
| 320x720 | 4,387px | 1,523px | 0 | Off |
| 360x800 | 4,326px | 1,523px | 0 | Off |
| 390x844 | 4,307px | 1,504px | 0 | Off |
| 768x1024 | 3,366px | 1,101px | 0 | Off |
| 1280x800 | 2,281px | 1,114px | 0 | On, top 0 |
| 1440x900 | 2,261px | 1,114px | 0 | On, top 0 |

Required before/after screenshots were stored under
`/tmp/schemawise-ux14-before` and `/tmp/schemawise-ux14-after`; they are audit
artifacts and are not versioned.

## Accessibility, keyboard and network

- Native summary activation with Enter retained focus and toggled the issue.
- `Show in diagram` opened the Diagram, selected Analysis mode and focused the
  diagram content.
- 3NF/BCNF `View diagram` focuses the corresponding transformation region.
- Axe in real Chromium reported 0 violations for the combined default,
  Explain, Formal reasoning, Diagram, generated transformations and glossary
  states. Color-contrast remained an incomplete manual-check result only for
  decorative non-text glyphs; no contrast violation was reported.
- Opening Explain, Formal reasoning, Diagram and Concept Reference produced 0
  network requests.
- Editing `A` to `Changed` preserved historical `R(A,B,C)`, displayed `Out of
  date`, retained the historical diagram and disabled all transformation
  reruns/checks.

## First-time-user heuristic

Without help, Input explains relation/attribute/FD entry and Analyze is the
only global primary. The default summary directly answers key, prime
attributes, form status, issue-causing FD and minimal cover. Explain and Show
in diagram are adjacent to the evidence, and transformations immediately
follow the diagram surface. All eight discovery questions in the v1.4 brief
were answerable without searching a distant section.

## Issues

Resolved during implementation:

1. Medium: 3NF and BCNF repeated the same FD in separate default paths.
2. Medium: concept definitions competed with contextual result explanations.
3. Medium: transformation rerun actions dominated completed results.
4. Medium: BCNF View diagram initially opened the correct mode but not the
   exact operation; operation-specific focus was added.
5. Low: a generic `aria-labelledby` produced an axe incomplete result; the
   unnecessary attribute was removed.

No Critical, High or Medium implementation issue remains open.

## Final repository validation

- `npm run typecheck`: passed in API, Web and Engine.
- `npm test`: 43 files and 493 tests passed (API 140, Web 179, Engine 174).
- `npm run build`: passed in all three workspaces; the Web build completed with
  79 transformed modules.
- `npm run test --workspace @schemawise/web`: 18 files and 179 tests passed.
- `npm audit --omit=dev`: 0 vulnerabilities.
- `git diff --check`: passed.

## Classification

`UX SIMPLIFICATION V1.4: FROZEN`
