# SchemaWise Demo Entry UX — Public audit

Status: **PASS**  
Date: 2026-10-10  
Scope: public release of `2c0d191 fix(web): clarify demo entry path`. No product
changes were made during this audit.

## Release evidence

| Item | Evidence |
| --- | --- |
| Functional commit | `2c0d191c0968a0ade73d2a72e4b402994bad2d05` |
| GitHub Actions | CI run `38064309567`, completed `success`; Typecheck, Test, Build and Audit runtime dependencies all passed |
| Vercel deployment | `dpl_ZiFbM4DyP5zRZjV6G9wqRMeWgHcs`, `READY` |
| Deployed SHA | `2c0d191c0968a0ade73d2a72e4b402994bad2d05` |
| Alias | `https://schemawise.vercel.app` |
| Functional bundle evidence | Public HTML references `assets/index-CMGmyx6a.js`, distinct from the preceding deployment bundle |

The alias was assigned to the deployment. `/`, `/demo`, `/demo?view=analysis`
and `/demo?view=transform` returned HTTP 200. A real request through the
public mathematical proxy, `POST /api/v1/analysis`, returned HTTP 200 JSON
with the expected Basic-normalization result.

## Public visual and responsive audit

The public alias was rendered in Chromium at 320x720, 390x844, 768x1024,
1280x800 and 1440x900. The reference images and geometry used for comparison
are retained in [the local entry UX audit](demo-entry-ux-audit.md):
`after-320.png`, `after-390.png`, `after-768.png`, `after-1280.png` and
`after-1440.png`.

At every public viewport, horizontal overflow was 0px. The visible hierarchy
matches the approved audit: `INTERACTIVE DEMO`, `A schema is ready.`, editable
Basic normalization, the `Loaded example` selector, and the editor beginning
directly after the compact introduction. The footer reads `Developed by Pampa
Software`.

Desktop (1280/1440), tablet (768), and mobile (320/390) retained the three
Schema / Analysis / Transform links, with `Schema` marked `aria-current=page`
on initial entry. The selector has five choices: Basic normalization, Composite
key, 3NF versus BCNF, Enrollment, and Start from scratch (four supplied
examples plus the blank option).

## First viewport, copy and selector

The first viewport communicates all intended facts without moving or duplicating
the calculation action:

- a prepared Basic exercise is loaded and editable;
- another example can replace the draft;
- `Analyze schema` runs a real analysis;
- no account is needed and nothing is saved.

`Loaded example` labels the selector, whose associated helper says that another
example replaces the editable draft. Analyze remains the single primary
calculation action after the complete editor.

## Functional smoke

The public path Basic normalization -> Analyze -> Analysis -> Transform passed.
Analyze issued exactly one `POST /api/v1/analysis`, routed to
`/demo?view=analysis`, and moved focus to the Analysis `h1`. The response and
rendered result show candidate key `{A}`, 2NF satisfied, 3NF and BCNF violated,
and the issue `B -> C`.

`Explore transformations` opened Transform. `Generate 3NF synthesis` made the
real `POST /api/v1/synthesis/3nf` request and returned `{A, B}` and `{B, C}`
as a dependency-preserving, lossless result.

Changing to Composite key made no network request and replaced the draft. After
editing, choosing another example showed the accessible `alertdialog` “Replace
current example?”. `Keep working` retained the edited draft and restored focus
to `#demo-example`; confirming replacement did not run a calculation.

## Isolation, normal workspace, and accessibility

No `/auth/me`, auth, project, or persistence request occurred anywhere in the
Demo run. The mathematical analysis and synthesis calls used the existing public
API only. No data was written to a Project API or Neon.

The normal `/` workspace retains its original title, Schema / Analysis /
Transform navigation, New project, Open projects, Save, Sign in, and the Pampa
Software footer. No project was created or modified. Its anonymous session
notice was observed only on the normal workspace and is not attributed to Demo.

Headless Chromium axe results, recorded separately as required:

| Surface | Violations | Incomplete |
| --- | ---: | --- |
| Initial Demo desktop | 0 | `color-contrast` |
| Initial Demo mobile | 0 | `color-contrast` |
| Analysis | 0 | `color-contrast` |
| Replacement confirmation | 0 | `color-contrast` |

The incomplete color-contrast rule is a headless-browser result requiring a
manual contrast review; it is not counted as an axe violation. This audit does
not claim full WCAG conformance. Landmark, heading, labelled selector,
`aria-current`, accessible confirmation, cancellation focus restoration, and
post-Analyze heading focus were verified. Existing keyboard and route coverage
also passed in the 237-test Web suite.

## Network, console, and limitations

Selection and view navigation made zero API requests. Explicit mathematical
actions each made one request. Chromium recorded no console messages or runtime
exceptions and no failed production asset. One `net::ERR_ABORTED` appeared only
when the audit script superseded its initial target navigation; it was not an
application request or failed asset.

No Critical, High, or Medium regression was found. No product fixes were made.
Deferred only: an automated axe `incomplete` is not a manual WCAG certification.

## Final release state

The functional release is public on the alias, CI is green, Vercel is READY,
the public bundle contains the approved refinement, and the normal workspace is
intact.
