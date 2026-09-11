# Educational UX v1.1 integral audit

Date: 2026-09-11  
Result: **EDUCATIONAL UX V1.1: FROZEN**

## Scope

This audit covers Educational UX v1.1 Tranches 1–5 in the React frontend:
analysis overview, candidate keys, prime attributes, minimal cover, normal-form
reasoning, closure, synthesis, BCNF decomposition, dependency preservation,
mathematical notation, contextual concept help, glossary, stale behavior,
responsive layout and accessibility structure. Backend/API contracts,
normalization algorithms, persistence semantics, auth behavior and deployment
configuration were not changed.

## Scenarios and evidence

Real Chromium was run against Vite and a deterministic local HTTP mock:

- A: `R(A,B,C)`, `A→B`, `B→C`; 2NF satisfied, 3NF/BCNF violated.
- B: `R(A,B,C)`, `AB→C`, `C→B`; multiple candidate keys, 3NF satisfied,
  BCNF violated through the prime exception.
- C: composite candidate key `{A,B}` with `A→C`; 2NF partial-dependency
  violation.
- E: BCNF decomposition followed by an observed `Not preserved` result and a
  returned lost dependency.
- F: empty starting determinant and empty returned closure, rendered as
  `∅⁺ = ∅` with one semantic reading.

Component/integration tests additionally cover satisfied and violated normal
forms, empty candidate key versus empty key list, multiple BCNF steps, multiple
violations, six-attribute composite keys, several lost/preserved dependencies,
loading/error/retry and transformation lifecycle behavior.

## Viewports and responsive result

Chromium checks ran at `320×720`, `360×800`, `390×844`, `768×1024`,
`1280×800` and `1440×900`. At every viewport,
`documentElement.scrollWidth === documentElement.clientWidth`; no page-level
horizontal overflow was found. The 320 px pass included expanded Concept Help,
Why, Formal reasoning and the full glossary. Controls, relation/FD notation,
normal-form rows, transformation relations, BCNF steps and glossary entries
remain in one linear DOM.

## Accessibility

### Structurally verified

- One `h1`; editor and tool sections use `h2`; Analysis uses `h2`; result
  sections use `h3`; transformation controls/results descend through
  `h4`/`h5`/`h6` without repeated parent levels.
- Sections and results use native landmarks or labelled `section`/`article`/
  `aside`; collections use `ol`, `ul` and `dl` according to meaning.
- Why/Formal/glossary use native `details`/`summary`. Concept Help uses a native
  button with `aria-expanded`, `aria-controls` and a labelled inline region.
- Enter/Space preserve focus on Concept Help; native Enter toggles Why, Formal
  reasoning and Concept reference. No focus trap or artificial focus move was
  found. Existing auth/project focus behavior and native controls remain intact.
- All audited buttons, summaries and checkbox labels measured at least 44 CSS
  px high at the 320 px viewport.
- Statuses include words and symbols, not color alone. Calculated contrast
  ratios for secondary, accent, success, danger, stale and primary text ranged
  from 5.60:1 to 14.01:1 against their relevant backgrounds.
- `axe-core` reports zero violations for the rendered educational surface with
  the jsdom-inapplicable color-contrast rule disabled.

### Manual screen reader deferred

DOM/accessibility-tree names were inspected, but no claim is made for a full
NVDA, JAWS or VoiceOver session. A physical iOS/Android touch pass is also
deferred to staging.

## Notation accessibility

`MathematicalNotation` renders the glyph string in an `aria-hidden` span and
exactly one visually-hidden semantic string. Verified cases include `∅`,
`∅⁺`, `A⁺`, `A → B`, `{A, B}`, `R(A, B, C)` and the hierarchy
`BCNF ⇒ 3NF ⇒ 2NF`. Functional dependencies use “functionally
determines”; closure and relation names use the historical snapshot. There is
no duplicate accessible reading between glyph and semantic text.

## Concept help and glossary

One TypeScript source defines all 16 requested concepts. Candidate key,
primary key and prime attribute are explicitly distinct; SchemaWise discovers
candidate keys and does not select a primary key. Transitive dependency is
defined conservatively and is not applied as a general 3NF violation test.
Contextual help appears once at useful section entry points for candidate key,
prime attribute, minimal cover, normal-form hierarchy and attribute closure.
Existing result-specific lossless/preservation and violation explanations are
not duplicated. The complete glossary is a closed-by-default, semantic,
two-column/one-column responsive definition list.

## Progressive disclosure and visual density

The hierarchy remains Result → Why? → Formal reasoning. Concept Help is a
sibling on-demand control rather than a nested fourth `details` layer. The
glossary is last in Analysis and closed by default. Existing nested Why/Formal
content is retained only where an outer violation group scopes several pieces
of evidence. Default result density remains compact: definitions, evidence and
the 16-entry reference are hidden until requested; no modal, tooltip-only help,
new card system or repeated badge layer was added.

## Stale behavior, network and regressions

After draft edits, candidate keys, prime attributes, minimal cover, NF
reasoning, closure, synthesis, BCNF and preservation retain their captured
snapshot labels and show stale state where applicable. Universal concept
definitions do not read the draft. Unit tests and a cleared Chromium request
log confirm that opening Why, Formal reasoning, Concept Help and the glossary
causes zero network requests and invokes no transformation callback.

Concept state is local component state only. It does not enter the workspace
reducer, dirty comparison, project revision, save/open payload, auth context or
storage. Existing auth/project suites pass unchanged apart from the global test
count.

## Live regions

Live output remains limited to async loading/completion, errors, stale results
and project save/session state. Concept Help and educational disclosures do not
use live regions. The redundant `aria-live` around the full Closure result was
removed; Closure request status remains the single announcement path.

## Content correctness

Repository-wide terminology review found no candidate/primary or prime/primary
conflation, no BCNF prime exception, no preservation/lossless conflation, no
claim that not-preserved means data loss, and no claim that 1NF is calculated.
The glossary and result copy consistently say 1NF is assumed.

## No-recomputation audit

The frontend does not implement closure, superkey, candidate-key search, prime
calculation, minimal cover, FD projection, NF evaluation, synthesis, BCNF
decomposition, dependency-preservation or chase algorithms. The only allowed
derived presentations remain membership/name lookup, cardinality, equality or
subset statements backed by DTO semantics, closure coverage against the same
captured snapshot, response ordering and formatting. The closure coverage
comparison is the documented exception: it classifies an already-returned
closure as covering all snapshot attributes; it does not calculate closure.

## Issues found and fixed

| Severity | Reproduction | Cause | Fix | Validation |
| --- | --- | --- | --- | --- |
| Medium | Central terms had no complete in-workspace reference. | Tranche 5 source/component absent. | Added 16 canonical definitions, contextual `ConceptHelp` and closed glossary. | Unit, keyboard, network and Chromium checks. |
| Medium | Transformation result headings repeated their parent `h4` level. | Visual sizing drove heading tags. | Corrected nested results to `h5`/`h6`; CSS keeps intended sizing. | Accessibility tree and tests. |
| Medium | Closure completion could announce both request status and the entire result subtree. | `aria-live` existed on the result in addition to request status. | Removed the result live region. | DOM inspection, tests and Chromium. |
| Low | FD spoken copy said “determines” without the precise qualifier. | Earlier accessible-name template. | Changed to “functionally determines”. | Notation tests and accessibility tree. |
| Low | Architecture and tranche status still described Concept Help as pending. | Documentation lag. | Updated content/component/architecture docs and freeze status. | Documentation review and `git diff --check`. |

No Critical or High issue was found. No relevant Medium issue remains open.

## Deferred

- Full manual NVDA/JAWS/VoiceOver passes.
- Physical iOS/Android visual and touch verification.
- Automated color-contrast evaluation in a layout browser; contrast was
  calculated from CSS tokens and visually inspected because jsdom cannot run
  that axe rule.
- Real staging visual audit after an authorized push/deploy, including platform
  fonts, browser/OS combinations and production proxy behavior.

## Final validations

- `npm run typecheck`: passed in API, Web and normalization-engine workspaces.
- `npm test`: 39 test files and 439 tests passed: API 10/140, Web 14/125,
  normalization engine 15/174.
- `npm run build`: passed; Web transformed 59 modules and emitted a 287.12 kB
  JavaScript bundle (83.24 kB gzip) and 25.42 kB CSS bundle (4.83 kB gzip).
- `npm run test --workspace @schemawise/web`: 14 files and 125 tests passed.
- `git diff --check`: passed with no whitespace errors.
- `npm audit --omit=dev`: 0 vulnerabilities.

## Final result

**EDUCATIONAL UX V1.1: FROZEN.** The remaining deferred checks are external
confidence passes, not known correctness, accessibility or UX defects. No push
or deployment was performed.
