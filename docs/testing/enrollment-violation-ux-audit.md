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
