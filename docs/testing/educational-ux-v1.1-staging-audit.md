# Educational UX v1.1 staging audit

Date: 2026-09-11  
Verdict: **EDUCATIONAL UX V1.1 STAGING: PASS WITH DEFERRED DEVICE/SCREEN-READER CHECKS**

## 1. Scope

This is the real-browser staging audit left pending by the local Educational UX
v1.1 audit. It covers the deployed educational analysis surface, Closure,
transformations, accessibility behavior, responsive behavior, network failure
recovery and auth/project isolation. It does not repeat deployment or basic API
smoke gates already approved before this audit.

## 2. Explicit exclusions

Pre-push validation, `git push`, Vercel deployment inspection, health/readiness
and the basic `/analysis` smoke were not repeated. No production environment,
tag, Render service, Neon resource or secret was created or changed.

## 3. Audited revision

The source and Vercel deployment revision is
`01817453d10c5052ccee9cc092b62617ff6d6303`. The public staging alias is
<https://schemawise-staging.vercel.app>. The worktree was clean before this
documentation-only record was created.

## 4. Previously approved deployment evidence

Vercel was `READY`, used Node 22, passed the Vite build, contained the Function
proxy and had the staging alias updated. Render required no redeploy because
there were no productive `apps/api` changes. `/health`, `/ready` and the basic
analysis proxy smoke had already returned 200.

## 5. Browser and method

The live alias was exercised with headless Chromium 152 on Linux x86_64 through
`agent-browser` 0.27.0. Evidence came from real interaction, accessibility-tree
snapshots, DOM/layout measurements, captured fetch requests, screenshots,
browser console/page-error inspection and in-page axe-core 4.13.0.

## 6. Scenario A

For `R(A,B,C)` with `A -> B` and `B -> C`, the browser rendered candidate key
`{A}`, prime attribute `{A}`, 2NF satisfied, and 3NF/BCNF violated. Both
violations identify `B -> C`; 3NF explains that `B` is not a superkey and `C`
is not prime, while BCNF explains the stricter determinant rule.

## 7. Scenario A educational reasoning

Candidate-key, prime-attribute and minimal-cover disclosures rendered the
Rule/Evidence/Conclusion hierarchy. The copy distinguishes candidate key from
selected primary key, uses the analyzed relation snapshot, and does not claim
an algorithm trace that the API did not return. The 2NF/3NF distinction and
`BCNF => 3NF => 2NF` hierarchy were correctly explained.

## 8. Scenario B

For `R(A,B,C)` with `AB -> C` and `C -> B`, the browser rendered candidate keys
`{A,B}` and `{A,C}`, prime attributes `{A,B,C}`, 2NF and 3NF satisfied, and
BCNF violated by `C -> B`. This is the intended prime-attribute exception:
3NF accepts the prime dependent while BCNF still requires `C` to be a
superkey.

## 9. Closure

With Scenario A and starting set `{A}`, Closure returned and rendered
`A⁺ = {A,B,C}` with the semantic reading “closure of A equals set containing A,
B and C”. The result explains that the set determines every relation attribute,
shows the captured relation/FD evidence, and exposes nested formal reasoning.
The request to `/api/v1/closure` returned 200 through Vercel.

## 10. 3NF synthesis

Scenario A synthesis returned `{A,B}` and `{B,C}`, identified their minimal-cover
source, and stated the algorithm guarantees: final relations in 3NF, dependency
preservation and lossless join. Nested reasoning was available without changing
the workspace draft.

## 11. BCNF decomposition

Scenario A decomposition returned final relations `{A,B}` and `{B,C}`. Step 1
showed source `R(A,B,C)`, violating dependency `B -> C`, and both result
relations. The UI correctly distinguishes lossless-by-construction from the
fact that dependency preservation is not guaranteed.

## 12. Dependency preservation

The live preservation check returned `Preserved` for the Scenario A BCNF
decomposition and labeled it as an observed/checked result. It did not conflate
preservation with lossless join. The request to
`/api/v1/analysis/dependency-preservation` returned 200 through Vercel.

## 13. Concept Help

All five contextual entry points were present: candidate key, prime attribute,
normal-form hierarchy, minimal cover and attribute closure. Controls use native
buttons with `aria-expanded` and `aria-controls`; the revealed definition is a
labelled region. Candidate/primary and prime/primary distinctions are explicit.

## 14. Glossary

The closed-by-default Concept reference contains all 16 canonical concepts in a
semantic definition list. Definitions for 1NF, BCNF, lossless join and
dependency preservation retain the required qualifications. It uses one column
at narrow widths and two columns from the tablet/desktop layout.

## 15. Progressive disclosure

The live hierarchy remains Result -> Why? -> Formal reasoning. Concept Help is
a sibling control, not another nested `details` level. Opening every educational
disclosure and the glossary produced a long but coherent linear reading order,
with no modal or focus trap.

## 16. Keyboard

Space toggled Concept Help while preserving focus; Enter toggled native
`summary` elements while preserving focus on the summary. Buttons, summaries
and checkbox labels remained keyboard reachable. At 320 px all actionable
button/summary/checkbox-label hit areas measured at least 44 CSS px; small
native checkbox glyphs sit inside those larger labels.

## 17. Heading and landmark structure

The rendered page had one `h1`. Editor/tools use `h2`, analysis uses `h2`, and
its sections descend through `h3`/`h4` as applicable. The accessibility tree
exposed named Project controls, Schema editor, Attribute closure, Analysis key
facts, Normal forms, Minimal cover, Violation details, Transformations and
Concept reference regions.

## 18. Notation accessibility

The expanded long-content surface contained 39 `MathematicalNotation`
instances. Every instance had exactly one glyph span with `aria-hidden=true`
and one non-empty visually-hidden semantic reading. Verified live examples
included sets, relation notation, closure, FDs and the normal-form hierarchy;
the accessibility tree did not duplicate glyph and spoken text.

## 19. Live regions

Educational disclosures and Concept Help created no live announcements.
Announcements remained limited to project dirty/session state, async request
status and stale state. Closure output had no second full-result live region,
so completion was not duplicated.

## 20. Axe

axe-core 4.13.0 against the fully rendered live surface reported **0
violations** and 40 passing rule groups. Manual-review/incomplete items were:
the visible-heading `aria-labelledby` on the non-semantic dependency-composer
`div`, and contrast checks that axe cannot calculate for three glyph-only,
`aria-hidden` decorative symbols. Neither produced an accessibility violation
or a missing accessible name; visible copy and semantic alternatives remain.

## 21. Screen-reader availability

Orca 50.2 with AT-SPI2 2.60.4 is installed on the audit host. The automated
browser runs in a separate headless Chromium accessibility context, so an
honest attended speech/navigation session could not be claimed. Accessibility
tree names and relationships were inspected, but Orca, NVDA, JAWS and
VoiceOver output remains a manual deferred check.

## 22. Viewports

Chromium was measured at `320x720`, `360x800`, `390x844`, `768x1024`,
`1280x800` and `1440x900`. At every size
`documentElement.scrollWidth === documentElement.clientWidth`; no page-level
horizontal overflow occurred. The glossary switched from one column at the
three phone widths to two columns at 768 px and above.

## 23. Long content

The relation `CUSTOMER_ORDER_HISTORY_RELATION` and attributes
`CUSTOMER_ACCOUNT_IDENTIFIER`, `REGIONAL_ORDER_REFERENCE` and
`FULFILLMENT_STATUS_CODE` were analyzed with Scenario B dependencies. Editor
labels, FDs, result heading, keys, evidence and glossary wrapped without
overlap, clipping or page overflow at all six viewports. Full-page screenshots
also showed a coherent narrow linear layout and desktop two-column workspace.

## 24. Stale behavior

After a draft relation-name edit, Analysis retained its captured `R(A,B,C)`
heading and displayed `Out of date`; Closure retained `{A}` and
`A⁺ = {A,B,C}` and displayed its own stale notice. Transformation actions were
disabled and referenced the stale-help text until reanalysis. Universal concept
definitions did not change with the draft.

## 25. Network isolation for educational controls

The browser request log was cleared before opening Concept Help, Why, Formal
reasoning and the glossary. The resulting request list was empty. These controls
perform no API call and do not invoke analysis or transformation operations.

## 26. Network failure and retry

The live analysis URL was explicitly aborted in the browser. The prior result
remained visible and stale, and the UI announced `Analysis failed` with the
connection/retry guidance. After removing the route and selecting Analyze again,
the alert cleared, the updated snapshot became `Current`, and analysis completed.
A transient cancelled automation request to BCNF showed the same safe error;
the immediate retry returned 200 and rendered the complete decomposition.

## 27. Auth regression

The initial `/api/v1/auth/me` returned the expected anonymous 401 without a
console error. Selecting Open projects while anonymous opened the labelled
`Sign in to save` region without a network request. Closing it by keyboard left
the project name, long draft and analysis result intact.

## 28. Project regression

Educational disclosure state did not alter `Untitled project`, dirty status or
the workspace payload. The unchanged Web suite passed auth context, API adapter
and project workflows, including save/update dirty comparison, open/new
confirmation, OCC conflict handling and missing-project recovery. No staging
user or project was created for this documentation pass.

## 29. Console and page errors

After Scenarios A/B, Closure, transformations, stale/retry, responsive changes,
long content and anonymous auth/project interaction, the browser console and
page-error collections were empty. The expected deliberately aborted request
was presented through the application error UI rather than an uncaught error.

## 30. Test-count reconciliation

Fresh, unambiguous commands produced:

- `npm run test --workspace @schemawise/api`: 10 files, **140 tests**.
- `npm run test --workspace @schemawise/web`: 14 files, **125 tests**.
- `npm run test --workspace @schemawise/normalization-engine`: 15 files,
  **174 tests**.
- `npm test`: the same 39 files and **439 tests** in total
  (`140 + 125 + 174`). The proxy-assertion workspace has no test script and is
  correctly skipped by `--if-present`.

The pre-push transcript proves that its root `npm test` also printed all three
workspace results, including Web 125, and then separately repeated Web 125.
The commentary value 314 was therefore a reporting arithmetic error:
`140 API + 174 Engine`; it accidentally omitted the already-passing 125 Web
tests. It was not an alternative global count, a suite reduction or a skipped
pre-push Web run.

## 31. Issues, fixes and deferred checks

No reproducible product defect was found, so no product code was modified and
no fix commit, push or redeploy was needed. The axe incomplete items in section
20 are recorded as manual-review observations, not violations. Deferred checks
are an attended screen-reader pass (Orca/NVDA/JAWS/VoiceOver), physical iOS and
Android touch/visual passes, and broader browser/OS combinations.

## 32. Final classification

The deployed Educational UX v1.1 matches the intended mathematical content,
progressive disclosure, snapshot/stale model, network behavior, accessibility
structure and responsive layout. Automated and Chromium-real checks found no
blocking defect. Only device and attended screen-reader confidence checks remain.

**EDUCATIONAL UX V1.1 STAGING: PASS WITH DEFERRED DEVICE/SCREEN-READER CHECKS**
