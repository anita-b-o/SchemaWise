# Multi-Surface Workspace public audit

Date: 2026-09-26 (America/Argentina/Buenos_Aires). Public demo:
<https://schemawise.vercel.app>. Scope: continuation of the already-approved
Schema → Analysis → Transform release audit. This audit did not redesign the
product, add features, alter Render or Neon, or create a manual deployment.

## Recovered source and deployment

The interrupted run left no repository changes. `HEAD`, `master`,
`origin/master`, and the remote `master` ref all resolved to
`6f17380417d1f6ed755a967f668e84fbe361d805`. The worktree and index were clean.
`/tmp/schemawise-public-probe.cjs` no longer existed and was not product source.
The only relevant `apps/web/package.json` change was already committed in
`6f17380`: the Web workspace explicitly declares
`@schemawise/normalization-engine`, with the matching lockfile entry.

Vercel inspection resolved the clean alias to deployment
`dpl_13SYxhXA3o522kyrvbkCsDcWc2Lc`, unique URL
`schemawise-staging-1nzejdm1y-anita-b-o.vercel.app`, target `production`, state
`READY`. Its build log explicitly records branch `master`, commit `6f17380`,
successful engine compilation, completed Web build, and completed deployment.
The clean alias, staging alias, Git alias, and project alias all point to this
deployment. `/`, `/?view=analysis`, and `/?view=transform` returned HTTP 200.

GitHub CI run 35634653742 for the full `6f17380` SHA completed successfully.
The already-approved gates were Typecheck, Test, Build, and runtime Audit. No
full local suite was repeated because the source SHA had not changed and there
were no pending productive changes.

## Render and same-origin API

The sleeping Render Free service woke without redeployment. Direct checks
returned:

- `/health`: HTTP 200, `application/json`, `{"status":"ok"}`.
- `/ready`: HTTP 200, `application/json`, `{"status":"ready"}`.

A same-origin `POST https://schemawise.vercel.app/api/v1/analysis` for the
three-attribute example returned HTTP 200 with
`content-type: application/json; charset=utf-8`, candidate key `A`, the expected
normal-form diagnostics, and Render/Vercel response headers. It did not return
the SPA document.

## Entry and surface ownership

The public entry rendered the Schema surface with one active
`aria-current="page"`, a three-link Workspace navigation (Schema, Analysis,
Transform), the local-schema context bar, project controls, relation/attribute/
FD editor, Load example, Analyze action, decorative birds, and the global
footer. The footer link resolved to <https://pampasoftware.com.ar/>. Birds were
present only on Schema; Analysis and Transform contained no image.

Surface ownership remained distinct:

- Schema owned the input task and editor.
- Analysis owned the immutable analyzed snapshot, explanations, reasoning,
  diagnostics, minimal cover, and analysis diagram; the editor was absent.
- Transform owned 3NF, BCNF, preservation, comparison, and transformation
  diagrams; the editor and full Analysis article were absent.

## Case A: `R(A,B,C)`

Load example produced `R(A,B,C)`, `A → B`, and `B → C`. Analyze remained on
Schema while its request was pending, including Schema `aria-current` and the
`Analyzing schema…` status. The successful request pushed `?view=analysis` and
focused the Analysis h1.

The public result contained:

- candidate key `{A}` and prime attribute `{A}`;
- 2NF satisfied;
- 3NF and BCNF violated;
- one issue, `B → C`;
- minimal cover `A → B` and `B → C`.

Explain candidate keys, its nested Formal reasoning disclosure, and Diagram
opened locally with zero captured API/fetch/XHR requests. The diagram showed
the analyzed schema and both entered dependencies.

Explore transformations pushed `?view=transform`, focused the Transformations
h1, and made no computation request. The three explicit actions each made one
successful POST:

| Action | Request | Public result |
| --- | --- | --- |
| 3NF | `POST /api/v1/synthesis/3nf` | `{B,C}`, `{A,B}`; dependency preserving; lossless |
| BCNF | `POST /api/v1/decomposition/bcnf` | `{B,C}`, `{A,B}`; one step; lossless |
| Preservation | `POST /api/v1/analysis/dependency-preservation` | Preserved |

## History, focus, and stale snapshots

Transform → Back → Analysis → Back → Schema → Forward → Analysis → Forward →
Transform restored the complete in-memory analysis and all three transformation
results. It made zero new computation requests. Back/Forward left focus on the
document body rather than injecting destination focus.

After changing `C` to `DraftC`, Analysis and Transform both reported **Out of
date**. Analysis retained `R(A,B,C)` and the historical findings. Its diagram
contained only `A`, `B`, `C`, `A → B`, and `B → C`; it contained no `DraftC`
and explicitly said that it remained tied to `R(A,B,C)`. This publicly
certifies the snapshot fix in `a3739c3`.

Stale Transform retained the historical 3NF, BCNF, and preservation results.
Every Run again/Check again operation was disabled. A successful Analyze again
made one Analysis POST, returned Analysis to **Current**, and invalidated the
old transformation resources; Transform returned to its uncomputed action
state.

Explicit keyboard activation confirmed:

- Analyze success focused the Analysis h1.
- Enter on Explore transformations focused the Transformations h1.
- Enter on the exact Edit schema link focused the Schema h1.
- Space expanded and collapsed Issues from 8 → 44 → 8 while retaining focus.
- Tab and Shift+Tab traversed the global wordmark and local navigation without
  a trap.
- Back/Forward did not add artificial focus.

## Enrollment analysis

The stable fixture used attribute identity ordering equivalent to the approved
`d,c,a,b,e,f` fixture, visible names Student, Course, Professor, Department,
Grade, Office, and these FDs in order:

1. `{Student, Course} → Grade`
2. `Course → Professor`
3. `Professor → Department`
4. `Professor → Office`
5. `Department → Office`

Public Analysis returned candidate key and prime attributes
`{Student, Course}`, 3 2NF violations, 44 3NF violations, and 44 BCNF
violations. Issues rendered 8 items initially, 44 after Show all, and 8 after
Show fewer, without a request. The minimal cover contained exactly four FDs:
`Professor → Department`, `Department → Office`, `Course → Professor`, and
`{Student, Course} → Grade`; redundant `Professor → Office` was absent.

BCNF decomposition is not unique. A separate pass with naturally generated
UUID ordering returned a different valid lossless set of BCNF leaves. The
stable fixture was then used to verify the release's exact deterministic
expected result rather than treating one valid alternative as a failure.

## Enrollment transformations

Public 3NF synthesis returned, in response order:

- `{Professor, Department}`
- `{Course, Professor}`
- `{Department, Office}`
- `{Student, Course, Grade}`

It reported dependency preserving and lossless join. Public BCNF returned:

- `{Professor, Department}`
- `{Course, Professor}`
- `{Professor, Office}`
- `{Student, Course, Grade}`

It reported three ordered decomposition steps and lossless join. Preservation
returned **Not preserved** and exactly one lost dependency,
`Department → Office`. Analysis, 3NF, BCNF, and preservation each made exactly
one successful same-origin POST.

## Responsive and visual audit

Schema, Analysis, and full Enrollment Transform were exercised at 320×720,
390×844, 768×1024, 1024×768, and 1440×900. At every size the document
`scrollWidth` equalled the viewport width. The local navigation fit its
container, all three surface links remained distinct and usable, and the
footer remained present. Birds appeared only on Schema.

At 320 px, the context bar wrapped cleanly, the three equal-width surface tabs
fit in 300 px, project actions wrapped, schema fields stacked, transformation
relations wrapped without clipping, and the preservation result and footer
remained inside the viewport. There was no element extending beyond either
horizontal edge.

The public product now follows the intended FlowMind-like flow principle in a
concrete, non-aesthetic sense: Schema offers one input task; Analyze creates a
perceptible pending-to-Analysis transition; Analysis is a dedicated
understanding surface; Transform is a dedicated decision/comparison surface;
Edit and Back provide clear returns; and mobile no longer forces the editor and
all results into one continuous page.

## Accessibility, network, and console

Browser axe-core 4.12.1 results:

| State | Violations | Incomplete |
| --- | ---: | ---: |
| Schema populated, mobile 320 | 0 | 1 |
| Analysis current | 0 | 0 |
| Analysis stale | 0 | 0 |
| Transform empty | 0 | 0 |
| Transform full | 0 | 0 |
| Transform full, mobile 320 | 0 | 0 |
| Transform stale | 0 | 0 |

The single incomplete result was axe's color-contrast check for the decorative,
`aria-hidden` dependency arrow. It is recorded as incomplete rather than an axe
PASS. Manual computed-style verification found foreground `rgb(11,103,88)` on
`rgb(244,243,239)`, a 6.11:1 contrast ratio.

Surface navigation, history, Explain, Formal reasoning, Diagram, and Issues
disclosure produced zero API/fetch/XHR requests. Analyze produced one request;
3NF, BCNF, and preservation each produced one. Re-entering Schema could emit
one ordinary GET for its decorative bird asset; it was not a computation or
API request. There were no repeated calls or loops.

The browser console contained zero messages and the page-error collection was
empty after the complete flow: no React/router warnings, unhandled promises,
duplicate-key reports, loops, asset failures, or exposed secrets were observed.

## Persistence checks

The public browser was signed out and no existing test account/session was
available. Save New was therefore **DEFERRED**, not failed; no arbitrary
credentials or smoke data were created. Project deep-link refresh semantics
were also **DEFERRED** because there was no safely writable smoke project.
Their focused local browser/test evidence remains in the Tranche 4 audit, but
this document does not relabel that evidence as a public authenticated pass.

## Vercel clean-build incident

The release incident is retained explicitly:

1. Deployment `schemawise-staging-pzr24nswh-anita-b-o.vercel.app` cloned
   `b159db5` and failed. The isolated Web build could not resolve
   `@schemawise/normalization-engine` from shared API mapper/use-case sources.
2. `a01e562` added the Web `prebuild` that compiles the engine first. Deployment
   `schemawise-staging-6vypqymcf-anita-b-o.vercel.app` compiled the engine but
   still failed resolution in the isolated Web workspace.
3. The failure was reproduced from `apps/web`, matching Vercel's workspace
   installation/build boundary. The root cause was that Web did not explicitly
   declare the engine, so the isolated install did not link it for TypeScript.
4. `6f17380` added the explicit Web dev dependency and lockfile entry while
   retaining the prebuild. The clean Vercel-equivalent reproduction passed.
5. CI for `6f17380` passed Typecheck, Test, Build, and runtime Audit. Vercel
   cloned `6f17380`, built the engine and Web successfully, completed deployment,
   reached `READY`, and received the clean `schemawise.vercel.app` alias.

No Render, Neon, secret, migration, or manual-deployment change was needed.

## Issues, fixes, and disposition

No Critical, High, or Medium public defect was found. No product file was
changed. The one axe incomplete item was recorded and manually checked; it did
not become an automated PASS. The alternate valid BCNF decomposition from a
different opaque-ID ordering is the already-documented non-uniqueness of BCNF,
not a correctness failure.

Authenticated Save New and project refresh remain the only deferred public
checks. All applicable public gates passed.

**MULTI-SURFACE WORKSPACE PUBLIC: PASS**

**SCHEMAWISE: PORTFOLIO READY**
