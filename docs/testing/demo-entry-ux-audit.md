# SchemaWise Demo V1 — First impression UX audit

Status: **DEMO ENTRY UX: PASS**  
Date: 2026-10-10  
Scope: public `/demo` entry only. No API, engine, fixture, Auth, Project or
persistence behavior was changed. No push or deployment was made.

## Method

The existing local frontend was opened in real Chromium at 320x720, 390x844,
768x1024, 1280x800 and 1440x900 before and after the change. Measurements are
DOM geometry in CSS pixels. Each image captures the initial viewport, without
scrolling or opening a disclosure.

| Viewport | Before | After |
| --- | --- | --- |
| 320x720 | [before](../assets/screenshots/demo-entry-ux/before-320.png) | [after](../assets/screenshots/demo-entry-ux/after-320.png) |
| 390x844 | [before](../assets/screenshots/demo-entry-ux/before-390.png) | [after](../assets/screenshots/demo-entry-ux/after-390.png) |
| 768x1024 | [before](../assets/screenshots/demo-entry-ux/before-768.png) | [after](../assets/screenshots/demo-entry-ux/after-768.png) |
| 1280x800 | [before](../assets/screenshots/demo-entry-ux/before-1280.png) | [after](../assets/screenshots/demo-entry-ux/after-1280.png) |
| 1440x900 | [before](../assets/screenshots/demo-entry-ux/before-1440.png) | [after](../assets/screenshots/demo-entry-ux/after-1440.png) |

## Initial findings

The original page was usable, but its generic Schema introduction did not say
that this was an interactive demo, that Basic normalization was already
loaded, or that it could be edited. The visual `Example` select showed Basic
normalization, yet its nearby helper only described the normalization concept;
it did not identify the selection as the current editable draft.

This was an observable first-time comprehension issue rather than a visual
preference. The initial primary action remains intentionally after the complete
editor: moving or duplicating Analyze would hide inputs or create competing
actions. The original header is 65px at every tested size and was not changed.

## First-time task test

After the change, the first reading sequence is:

1. `Interactive demo` / `A schema is ready.` establishes purpose and state.
2. The next sentence says Basic normalization is loaded, editable, switchable,
   analyzed by the existing real action, and needs neither an account nor a
   save.
3. The toolbar labels the control `Loaded example`; its description says that
   choosing another item replaces the editable draft.

The editor continues to expose every attribute and functional dependency. The
single existing `Analyze schema` button remains at the end of the input flow;
there is no hero CTA, duplicate Analyze button, automatic scrolling, tutorial,
modal, landing section or illustration.

The temporary-state notice remains in the workspace context, so it is visible
without becoming the dominant introduction.

## Alternatives considered

| Option | Assessment |
| --- | --- |
| A. Copy and hierarchy only, retaining the generic intro | Low implementation cost, but it leaves the primary heading disconnected from Demo state. |
| B. Compact intro and emphasize the selected example | Improves scan speed, but by itself can read as a layout optimization rather than a clear action path. |
| C. Replace the existing intro with contextual copy connecting loaded example, editing, selector, real Analyze, and temporary use | Best clarity-to-complexity ratio. It uses the existing intro and toolbar only, preserving the visual identity and all three workspace surfaces. |

## Selected approach and implementation

Option C was selected. `WorkspaceSurfaces` accepts an optional route-specific
Schema introduction; the normal workspace continues to use its original
introduction unchanged. Demo supplies concise contextual copy and improves the
existing select label/helper. The Demo-only title scale is slightly smaller to
keep that copy compact without changing editor spacing or hiding content.

The implementation changes only:

- `DemoWorkspaceHost.tsx`: Demo contextual copy and existing selector label/help.
- `WorkspaceSurfaces.tsx`: optional introduction composition point.
- `styles.css`: Demo-title type scale.
- `demo-route.test.tsx`: asserts the new entry message while retaining existing
  isolation, selector, dirty, focus, and single-request coverage.

## Before/after metrics

`top` is the distance from the document top. `Analyze` remains below all
editable fields by design. Horizontal overflow was `0px` in every run.

| Viewport | Document height | Intro height | Selector top | Attributes top | FDs top | Analyze top |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 320 | 2930 → 2857 (-73) | 211 → 171 | 562 → 522 | 1080 → 1007 | 1642 → 1569 | 2551 → 2478 |
| 390 | 2795 → 2746 (-49) | 178 → 145 | 529 → 496 | 993 → 944 | 1555 → 1506 | 2416 → 2367 |
| 768 | 2284 → 2222 (-62) | 166 → 120 | 471 → 426 | 847 → 785 | 1409 → 1347 | 1975 → 1912 |
| 1280 | 2379 → 2285 (-94) | 210 → 133 | 541 → 464 | 916 → 823 | 1479 → 1385 | 2044 → 1950 |
| 1440 | 2379 → 2285 (-94) | 210 → 133 | 541 → 464 | 916 → 823 | 1479 → 1385 | 2044 → 1950 |

The first available interaction is the selector. Its pre-action distance from
the bottom of the fixed site header is reduced from 497px to 457px at 320px,
from 464px to 431px at 390px, and from 476px to 399px at 1280px/1440px. This
is a consequence of removing redundant wording, not a reduction of editor
content.

## Responsive review

- Desktop (1280/1440): the whole contextual summary and loaded selector are
  visible before the relation field. The selected helper is one compact line.
- Tablet (768): intro and selector remain above the first attribute; all
  controls stay within viewport width.
- Mobile (320/390): the example selector is fully visible in the first
  viewport, the title and context wrap normally, and there is no horizontal
  scroll. Analyze remains after the complete accessible editor rather than
  being artificially moved ahead of attributes or dependencies.

## Accessibility and interaction validation

- Real Chromium axe: 0 violations on initial Demo Schema and completed Demo
  Analysis.
- The select keeps the accessible name `Example` and gains an associated
  description explaining replacement of the editable draft.
- Keyboard/focus behavior was retained: cancelling dirty example replacement
  returns focus to `#demo-example`.
- Existing unit coverage passes for direct Demo entry, direct Analysis and
  Transform states, selector replacement, dirty confirmation, view history,
  stale results, and duplicate Analyze prevention.

## Network, console, and regressions

In real Chromium, initial Demo entry and changing examples produced no API
request. Clicking Analyze made exactly one `POST /api/v1/analysis`; no
`/auth/*` or `/projects*` request occurred. The run had no console errors.

The local normal workspace at `/` still renders its original heading,
authentication/project controls and shared editor path. Its presentation was
not given the Demo introduction. Existing Project Recovery and workspace
coverage remains part of the full validation suite.

## Trade-offs and recommendation

The introductory text names Analyze before it is physically visible. This is
intentional: the full editor must remain editable and accessible before the
single real analysis action. A secondary CTA or an auto-scroll would make the
path more visually immediate but would violate the scope and compete with the
existing action.

Keep this focused entry framing. Future work, if needed, should be measured
first with moderated first-use sessions; it should not add marketing treatment
or change the input/analysis/transform surfaces without new evidence.

## Final validation

All required gates passed:

- `npm run typecheck`: passed (Engine build plus API, Web and Engine checks).
- `npm test`: 50 files and **552 tests** passed (API 142, Web 237, Engine 173),
  matching the stated 552-test baseline.
- `npm run build`: passed; the Web production build transformed 90 modules.
- `npm run test --workspace @schemawise/web`: 25 files and 237 tests passed.
- `git diff --check`: passed.
- `npm audit --omit=dev`: 0 vulnerabilities.
