# Frontend MVP v1 audit

Date: 2026-09-09

Status: frozen after fixes

## Scope and method

The complete single-page workspace was audited in headless Google Chrome
against the real Vite frontend and Fastify API. The primary path used no mocked
responses. Browser checks covered the initial draft, example loading, analysis,
3NF synthesis, BCNF decomposition, dependency preservation, attribute closure,
draft staleness, validation, loading and network failure.

Viewports:

- 320 x 720: initial/editor/result flow, long unbroken names, transformations,
  closure, stale state and horizontal overflow.
- 390 x 844: validation, loading, closure, stale state and touch layout.
- 768 x 1024: tablet single-column flow.
- 1280 x 800 and 1440 x 900: two-column hierarchy, line length, result density
  and complete transformation output.

## Findings and fixes

| Severity | Finding | Resolution |
| --- | --- | --- |
| Medium | API attribute sets could render in engine traversal order, producing variable notation such as `{B, A, C}` for `R(A, B, C)`. | Display-only set formatting now follows the immutable relation snapshot order; a focused formatter test covers reversed input. |
| Medium | At exactly 320 px with a classic 15 px scrollbar, the body's 320 px minimum created horizontal page overflow. | Removed the global body minimum width; long 120-character relation and attribute names now wrap without page overflow. |
| Medium | Native disclosure summaries had an approximately 19 px active height; quiet actions and selector rows were slightly below the project's 44 px touch-target contract. | Disclosure, quiet-action and selector-label targets now have a minimum 44 px height. |
| Low | Transformation completion was visually evident but not explicitly exposed through the existing polite status regions. | Added concise completion messages for synthesis, BCNF decomposition and preservation. |
| Low | Empty-set closure helper copy described the notation without showing it. | The helper now presents `∅⁺` directly. |

No critical or high-severity issue remained after the fixes.

## Flow observations

- First use establishes the order Relation -> Attributes -> Functional
  dependencies -> Analyze. `Load example` remains available but subordinate,
  while `Tools` stays collapsed below the primary editor.
- The example is legible as `R(A, B, C)`, `A → B`, `B → C`; counters and
  row actions remain clear at every tested width. Technical IDs stay behind
  native `Advanced` disclosures.
- Results retain a useful order: keys and prime attributes, normal forms,
  minimal cover, expandable violations, then transformations. Satisfied and
  violated states use symbols and words in addition to color. The 1NF
  assumption is present as quiet supporting text.
- 3NF synthesis states its dependency-preserving and lossless guarantees. BCNF
  decomposition separately states its BCNF/lossless guarantee and that
  dependency preservation is not guaranteed; the explicit preservation check
  is adjacent to the BCNF result.
- Closure is discoverable as a secondary tool, accepts the empty set, renders
  `∅⁺`, and retains its own stale snapshot independently of analysis.
- Editing an attribute after analysis leaves prior results visible, marks both
  applicable snapshots `Out of date`, preserves old labels and disables all
  transformation actions until re-analysis.
- Duplicate attributes, empty relation name, duplicate FD and the six-attribute
  limit are local, concise and associated with their controls. A forced offline
  request produced the scoped network error while retaining the draft and prior
  result.
- Loading was observed by temporarily pausing the local API process. Previous
  results remained visible on retries, labels described the active operation,
  `aria-busy` was applied where appropriate and no large spinner or layout jump
  appeared.

## Accessibility and responsive result

Native labels, fieldsets/legends, buttons, details/summary, regions and heading
levels form a linear DOM order. Keyboard-only verification covered example
loading, relation and attribute editing, add/remove, FD edit/cancel, analysis,
violation disclosure, both transformations, preservation and closure. Focus
used a visible 3 px outline and did not become trapped. Error messages use
`aria-describedby` and alerts; asynchronous operations use busy and live/status
semantics. Status meaning never depends on color alone.

There was no application-level horizontal scrolling at any audited viewport
after the fix. The 768 px layout remains a deliberate single column rather than
an undersized desktop hybrid. At desktop sizes, the editor/result split remains
approximately 40/60 with controlled line lengths.

## Limitations

- The audit used headless Chrome and DOM/accessibility inspection; it did not
  include a physical iOS/Android device or a full manual NVDA/VoiceOver session.
- Network failure was simulated with Chrome offline mode after the real-server
  flow. Loading was simulated by pausing the real local API process; production
  latency characteristics were not measured.
- Screenshots were temporary audit artifacts and were not added to the repo.

## Freeze gate

The real browser flow, mobile and desktop layouts, focused web tests, global
tests, typecheck, production build and diff validation passed. The working tree
was clean after the two freeze commits. Frontend MVP v1 is frozen; persistence
remains explicitly out of scope.
