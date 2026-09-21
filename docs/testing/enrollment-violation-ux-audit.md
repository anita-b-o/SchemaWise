# Enrollment violation presentation audit

## Mathematical contract

The 2NF analyzer checks closures of proper subsets of candidate keys and records each non-prime dependent. The 3NF analyzer checks the closure of every attribute subset, then records each non-trivial singleton dependency whose determinant is not a superkey and whose dependent is not prime. BCNF performs the same subset and closure traversal without the prime-attribute exception. These are enumerated implications of the input FDs, rather than a minimal list of independent problems. The implementation does not materialize or return a general F+ object.

With the six Enrollment attributes and five FDs, the engine returns one candidate key `{Course, Student}`, four minimal-cover FDs, and 3, 44, and 44 violations for 2NF, 3NF, and BCNF respectively. In each 44-entry array, six entries have one-attribute determinants, 17 have two, 16 have three, and five have four. These are distinct determinant/singleton-dependent pairs produced by subset closure, with superkey and trivial cases excluded. The API mapper forwards the arrays and their order without filtering. The UI groups equal determinant/dependent pairs across normal forms, so the Issues count is the count of distinct displayed dependencies, not a sum of the three diagnostic counts. For this fixture that count is 44.

The DTO exposes candidate key (2NF only), determinant, and dependent. It carries no source FD, derivation path, provenance, minimality, or redundancy certificate. Exact identity with a singleton input FD could be checked against the analyzed snapshot, but would not establish why the engine emitted that violation or whether it is an independent explanation. Classifying explanatory redundancy would require additional mathematical work. The UI must not label an issue as original, derived, fundamental, or a root cause.

## Scope decision

The demonstrated friction is the length and interpretation of a 44-item Issues list. A local disclosure of the already returned, already grouped list addresses it without changing mathematics, DTOs, APIs, or routing. Keep all diagnostic counts and all issues available. Show all issues for counts up to eight; otherwise show the first eight and a button to expand or collapse the rest. The short explanation should say that the analysis includes dependencies implied by the entered FDs. The existing ordered list, exact diagram selection IDs, and analyzed snapshot remain authoritative.

BCNF decomposition selects its first violation in engine order. This order is based on attribute IDs, so different stable IDs can yield different valid BCNF decompositions and different preservation outcomes for the same named FDs. The regression fixture uses stable IDs that reproduce the manually observed decomposition. This is an existing engine characteristic, not part of the presentation change.

## Browser and rendering evidence

Measured on the local Vite page with the Enrollment input and the API running locally. For the baseline, the pre-change `ViolationDetails` component was briefly loaded through Vite hot reload, then restored; the same analysis state was measured at each viewport. Heights are the `AnalysisResults` article in CSS pixels. The expanded post-change height includes the added copy and disclosure button.

| Viewport | Before: 44 visible | After: 8 visible | After: 44 expanded | Horizontal overflow |
| --- | ---: | ---: | ---: | ---: |
| 320×720 | 10277 | 3162 | 10397 | 0 |
| 360×800 | 9978 | 3129 | 10099 | 0 |
| 390×844 | 9915 | 3110 | 10035 | 0 |
| 768×1024 | 4521 | 1839 | 4623 | 0 |
| 1280×800 | 4548 | 1866 | 4649 | 0 |
| 1440×900 | 4548 | 1847 | 4631 | 0 |

At 1280 px, the Issues subtree had 887 DOM descendants initially and 4163 when expanded, versus 4161 in the old always-expanded component. A single expand measurement including two animation frames took about 305 ms in this local browser session. Resource request count stayed at 54 through expansion and collapse. This is DOM disclosure only; the complete API result stays in memory and the engine calculation is unchanged.

In Chromium, the last initially hidden issue opened Explain issue and Formal reasoning, selected its exact 3NF diagram evidence, and moved focus to the diagram. Collapsing retained diagram selection and button focus. Editing the draft kept the old names in the analysis and marked it out of date. The browser also generated 3NF synthesis and BCNF decomposition with four relations each, three BCNF steps, and reported `Department → Office` lost for this instance. Axe on the expanded AnalysisResults returned zero violations; it reported one incomplete color-contrast check on existing visual elements whose backgrounds could not be determined automatically.

## Public demo audit — 2026-09-20 (America/Argentina/Buenos_Aires)

Audited `https://schemawise.vercel.app` in Chromium without signing in, saving a project, or changing persisted data. Vercel deployment `dpl_GQ132kn64QkeTzXUNm9Vaonu8fnD` is `READY`, was built from Git commit `3ddb11fe6a1156224313763a6de0e59e15b21711`, and has `schemawise.vercel.app` among its production aliases. Homepage returned HTTP 200. A `/projects/nonexistent-audit-path` request returned the SPA HTML with HTTP 200. `GET /api/v1/analysis` returned JSON 404 (`INVALID_REQUEST`) through the Function proxy, with Render origin headers, rather than the SPA document; the real analysis request returned JSON 200. No deployment was created manually. Baseline CI run [35547640481](https://github.com/anita-b-o/SchemaWise/actions/runs/35547640481) completed successfully for that commit.

Entered `Enrollment(Student, Course, Professor, Department, Grade, Office)` and the five specified FDs in order: `{Student, Course} → Grade`, `Course → Professor`, `Professor → Department`, `Professor → Office`, and `Department → Office`. The public analysis showed candidate key and prime attributes `{Student, Course}`; 2NF violated with 3 violations, 3NF violated with 44, and BCNF violated with 44. The three 2NF dependencies were `Course → Professor`, `Course → Department`, and `Course → Office`. The Issues heading showed `44 dependencies` while only eight list items initially existed in the DOM. The explanation says the analysis includes dependencies implied by the entered FDs; it does not claim 44 independent problems or use unprovided provenance or root-cause terminology.

The `Show all 44 issues` native button has `aria-expanded=false` and controls an ordered list with `role=list`. Activation rendered all 44 items, changed the control to `Show fewer issues` and `aria-expanded=true`, and preserved the 3/44/44 counts. The last initially hidden item, `Course, Department, Grade, Office → Professor`, opened both Explain issue and Formal reasoning. Show in diagram selected the matching 3NF evidence, displayed determinant `{Course, Department, Grade, Office}` and dependent `{Professor}`, set its action to `aria-pressed=true`, and moved focus to diagram content. Show fewer restored eight items and `aria-expanded=false`; focus remained on the toggle when it was used. Both Enter and Space activated the focused toggle. The diagram mode buttons and all these presentation actions produced zero captured fetch/XHR requests after the request log was cleared.

The minimal cover listed `Professor → Department`, `Department → Office`, `Course → Professor`, and `{Student, Course} → Grade`; redundant input FD `Professor → Office` was absent. Public 3NF synthesis returned four relations `{Professor, Department}`, `{Course, Professor}`, `{Department, Office}`, and `{Student, Course, Grade}`, with `Dependency preserving · Lossless join`. Public BCNF decomposition returned `{Professor, Department}`, `{Course, Professor}`, `{Professor, Office}`, and `{Student, Course, Grade}` in three steps, with `Lossless join`. Its preservation check returned `Not preserved` and lost FD `Department → Office`. The UI states that dependency preservation is a separate property from lossless join and that a lost dependency does not mean lost data. Analysis, synthesis, BCNF, preservation, and closure each produced one expected successful POST to the Function proxy; `{Student, Course}+` contained all six attributes.

Measured the Issues section in CSS pixels, with the public analysis and diagram open. Each state had zero horizontal document overflow; all 44 items remained accessible by disclosure, including on mobile. Heights are approximate and can vary with fonts and browser state.

| Viewport | Eight visible | All 44 visible | After Show fewer | Horizontal overflow |
| --- | ---: | ---: | ---: | ---: |
| 320×720 | 1682 | 8961 | 1682 | 0 |
| 390×844 | 1663 | 8589 | 1663 | 0 |
| 768×1024 | 749 | 3532 | 749 | 0 |
| 1440×900 | 730 | 3513 | 730 | 0 |

Ran axe with `color-contrast` enabled on the public page in both eight-item and 44-item states, using WCAG 2 A/AA and 2.1 A/AA tags. Each run returned zero violations, 26 passes, and 11 incomplete color-contrast nodes. Incomplete results require manual review and are not axe violations. The browser console and page-error log were empty after the interaction flow; no failed image assets, React warnings, duplicate-key messages, unhandled promises, ResizeObserver loops, proxy errors, or exposed secrets were observed. Anonymous auth behavior was not treated as a failure. Homepage, Load example, Analyze, Diagram, Closure, and the SPA deep link were exercised without project writes.
