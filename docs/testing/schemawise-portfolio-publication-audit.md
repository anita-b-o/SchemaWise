# SchemaWise portfolio publication audit

- Date: 2026-09-18
- Scope: final publication polish only; no product features
- Product decision retained: **READY AFTER SMALL FIXES**
- Final gate: **SCHEMAWISE: READY AFTER MANUAL PUBLICATION STEPS**

## Decision

The repository-side publication work is complete and all local quality gates
pass. No P0 or P1 product issue remains. The only incomplete publication work
is the coordinated public-hostname transition: Render currently authorizes the
staging Origin and the preferred clean Vercel alias has not been assigned.

No educational, recovery, visualization, normalization, transformation,
project, authentication, or routing scope was reopened.

## Cold-start solution

`DelayedAsyncHint` is a deliberately small presentation primitive. It starts a
timer for the active `requestId`, stays hidden for 6 seconds, and then adds this
secondary copy without replacing the operation status:

> The public demo server may be waking up. Free-tier cold starts can take a
> little longer.

The timer resets when a new request replaces the current one and is cleared on
completion, failure, request replacement, and unmount. It does not change an
HTTP timeout, cancel or retry a request, poll, ping, keep a service awake, or
create any network request.

The hint is used by the five computational operations most relevant to the
anonymous demo:

- Analyze;
- Attribute Closure;
- 3NF Synthesis;
- BCNF Decomposition; and
- Dependency Preservation.

Auth initialization and project operations can encounter the same sleeping
API, but retain their existing task-specific loading and recovery states. A
second delayed message there would duplicate announcements outside the primary
recruiter path. The first computational operation also wakes the shared API.

Six seconds was selected because it is above observed warm responses and inside
the requested 4–8 second range. It avoids flashing infrastructure copy during
normal latency while explaining a wait before a user is likely to assume the
demo is stuck.

## Accessibility and browser evidence

- Existing operation status remains in its polite live region.
- The delayed paragraph is inserted once with `role=status`, `aria-live=polite`,
  and `aria-atomic=true`.
- It disappears on success and error; it does not accumulate across retries.
- Fake-timer coverage verifies pre-threshold absence, post-threshold presence,
  success/error removal, retry reset, one request only, and unmount cleanup.
- Browser delay harness: one visible hint, one analysis request, no horizontal
  overflow at 390 px, and 0 axe violations.
- Responsive smoke: empty workspace, analyzed state, and delayed state at 390,
  768, and 1440 px; no horizontal overflow or Vite error overlay.

## README publication surface

The previous README was a short internal development note. It did not explain
the audience, product value, live demo, educational model, visualizations,
security boundary, measured UX iteration, current limitations, or selected
technical reading path.

The replacement README now provides:

- a WHAT / WHO / VALUE proposition above the fold;
- one public-demo link stored as a single reference for the alias transition;
- five real staging screenshots;
- concise capability, educational UX, visualization, transformation,
  architecture, security, testing, and limitation sections;
- the verified v1.4 desktop and mobile height reductions with context;
- commands based on the actual npm workspaces and Node 22 runtime; and
- eight selected technical documents instead of an exhaustive document list.

GitHub's Markdown rendering endpoint parsed 16 headings. All five embedded
README images loaded at their 1440 px source width, no `/home/...` path was
present, and the rendered source contained no broken local image reference.

## Screenshots

All files are local PNGs captured from the real public staging application.
They contain only the built-in anonymous example and no personal data. The six
files total less than 500 KiB.

| File                                        | Viewport | State                         | Capability                                     | Suggested caption                                                                   |
| ------------------------------------------- | -------- | ----------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `schemawise-editor-analysis.png`            | 1440×900 | Example analyzed              | Editor plus compact result hierarchy           | Define a schema and inspect keys, prime attributes, and normal forms side by side.  |
| `schemawise-formal-reasoning.png`           | 1440×900 | 3NF issue expanded            | Rule / Evidence / Conclusion                   | Move from the result to the exact rule and evidence behind a 3NF violation.         |
| `schemawise-composite-fd-visualization.png` | 1440×900 | Diagram open with `{A,B} → C` | Composite determinant and explicit FDs         | Preserve composite dependencies as one accessible, deterministic visual relation.   |
| `schemawise-transformations.png`            | 1440×900 | 3NF and BCNF generated        | Distinct transformation outputs and guarantees | Compare dependency-preserving 3NF synthesis with lossless BCNF decomposition.       |
| `schemawise-dependency-preservation.png`    | 1440×900 | BCNF preservation checked     | Separate preservation result                   | Check dependency preservation explicitly instead of implying it from lossless join. |
| `schemawise-mobile-analysis.png`            | 390×844  | Example analyzed              | Responsive result hierarchy                    | Review the essential normalization evidence in a narrow mobile layout.              |

The README uses the first five. The mobile image is reserved for the portfolio
case study because it adds responsive evidence without lengthening the README.

## Portfolio copy

**Title:** SchemaWise — Interactive Relational Normalization Workspace

**One-line:** A full-stack educational tool that turns functional dependencies into
explainable normalization analysis, accessible diagrams, and safe
transformations.

**Short description:** SchemaWise helps database students define small relational schemas, analyze
candidate keys and normal forms, understand deterministic evidence, and compare
valid 3NF and BCNF transformations in one interactive workspace.

**Technical highlights**

- Independent deterministic TypeScript engine with bounded exhaustive
  algorithms.
- Fastify API, PostgreSQL persistence, owner-scoped access, and optimistic
  concurrency control.
- Signed same-origin Vercel-to-Render proxy with session, CSRF, and Origin
  controls.
- 497 default tests across API, Web, and engine plus separate PostgreSQL
  integration coverage.

**UX highlights**

- Result → Explain → Formal reasoning progression.
- Rule → Evidence → Conclusion explanations tied to the immutable snapshot.
- Semantic HTML/CSS visualization for composite dependencies and
  transformations.
- v1.4 result-height reduction of 36.3% desktop and 31.6% mobile through less
  duplication, progressive disclosure, and stronger hierarchy.

## Architecture and security presentation

The README presents the deployed path as:

```text
React/Vite Web → Vercel signed proxy → Fastify API on Render → Neon PostgreSQL
                                      ↘ independent TypeScript engine
```

Security copy is limited to implemented and tested controls: host-only
HttpOnly/Secure/SameSite cookies, Argon2id, CSRF plus exact Origin/Referer,
owner-scoped access, OCC, the signed proxy assertion, and auth rate limits. It
explicitly describes the system as a portfolio/demo architecture without a
production SLA.

## Testing presentation

Final default-suite count: **497 passed**.

| Workspace            | Tests |
| -------------------- | ----: |
| API                  |   140 |
| Web                  |   184 |
| Normalization engine |   173 |

PostgreSQL integration tests remain outside `npm test` because they require an
isolated database. The README pairs the count with representative mathematical,
request-lifecycle, accessibility, ownership/OCC, CSRF, proxy, and recovery
coverage rather than presenting quantity as a substitute for quality.

## Web metadata and identity assets

`apps/web/index.html` now includes:

- the existing `SchemaWise` base title;
- a concise meta description;
- `theme-color`;
- Open Graph title, description, type, image dimensions, and image alt;
- Twitter/X large-image metadata; and
- an explicit SVG favicon.

`og:url` and a canonical URL are intentionally absent until the clean public
hostname is assigned. The share image path is root-relative so it follows the
eventual alias without embedding staging. Project-route title behavior remains
`<Project name> — SchemaWise` and its existing tests pass.

The 1200×630 Open Graph image uses the existing green identity, the public value
proposition, and a real product screenshot. Its editable HTML/CSS source is
retained under `docs/assets`; the exported PNG is 252 KiB. The favicon is a
simple mark in the existing accent color, not a brand redesign or a Vite
placeholder.

## Documentation hygiene

- Added `docs/README.md` as a small current/historical routing index.
- Corrected future tense in the architecture overview.
- Marked original MVP requirements, frontend MVP, workspace UX, and frontend
  API integration as historical/superseded where their claims no longer match
  the shipped system.
- Preserved every historical document and the pending product/portfolio audit.
- Removed no audit evidence and performed no archive migration.

## Vacuous test

Deleted `packages/normalization-engine/tests/baseline.test.ts`. Its only
assertion was `expect(true).toBe(true)` under the obsolete name “has no
normalization algorithms implemented yet.” The engine retains 173 behavioral
tests across 14 files, so no useful coverage was removed.

## CI

Added one public GitHub Actions workflow for pull requests and pushes to
`master`, using Node 22 and npm cache. It runs:

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`
5. `npm audit --omit=dev`

It has read-only repository permissions, no deploy step, no secrets, no matrix,
and no external PostgreSQL integration. `actionlint 1.7.12` reported no issue.
A badge is intentionally deferred until the first pushed run succeeds.

## Public URL decision and safety audit

Current Vercel project: `schemawise-staging` on the Hobby plan. Current public
alias: <https://schemawise-staging.vercel.app>.

Preferred clean alias: <https://schemawise.vercel.app>. On 2026-09-18 the three
candidate hostnames returned Vercel `404 DEPLOYMENT_NOT_FOUND` and none appeared
as a project in the connected team:

1. `schemawise.vercel.app`
2. `schemawise-app.vercel.app`
3. `schemawise-normalization.vercel.app`

This is encouraging but is not represented as a reservation. Vercel confirms
availability only when the alias/project name is actually assigned.

The Render service is `schemawise-api-staging`, Free, Virginia, one instance,
with auto-deploy disabled. Live preflight evidence showed:

- `https://schemawise-staging.vercel.app` receives an exact
  `Access-Control-Allow-Origin`;
- each clean candidate receives no `Access-Control-Allow-Origin`; and
- `/ready` returns HTTP 200 with `{ "status": "ready" }`.

The new hostname would affect credentialed CORS plus the shared Origin/Referer
validation used by auth and project mutations. The Vercel proxy itself forwards
the browser Origin and needs no code change. Host-only cookies will be distinct
on the new alias, so users will sign in again there; no cookie weakening is
required.

## Remaining manual publication steps

Do these in order. Do not remove the staging Origin during the transition.

1. Review and push the cohesive local commits. Confirm the first GitHub Actions
   run is green and the Vercel production deployment for the existing project
   is READY.
2. In Render → `schemawise-api-staging` → Environment, append
   `https://schemawise.vercel.app` to the existing comma-separated
   `CORS_ORIGINS` value while preserving
   `https://schemawise-staging.vercel.app`. Save and deploy the environment
   change; auto-deploy is off.
3. Confirm `/ready` is 200, then repeat the login OPTIONS preflight from both
   Origins and require the corresponding exact ACAO value for each.
4. In the Vercel `schemawise-staging` project, add
   `schemawise.vercel.app` as a production domain/alias. If Vercel rejects it,
   stop and use the candidates above in order; update Render first for the
   chosen hostname. Do not guess a different hostname.
5. Validate the clean URL: base page and metadata, anonymous Analyze, 3NF,
   BCNF, preservation, register/login/logout, create/update/open/delete project,
   cookie host, Origin/Referer enforcement, mobile layout, and no console error.
   Keep the staging alias as a temporary technical alias throughout.
6. Replace the single `[live-demo]` reference in the README, add the final
   absolute `og:url`, and change `og:image`/`twitter:image` to absolute clean
   URLs if the target crawler requires them. Push that small release commit and
   revalidate both aliases.

No Render or Vercel mutation was made in this pass because the required Render
environment value could not be read safely through the connected tool and live
evidence proves the clean Origin is not yet authorized.

## Validation record

- `npm run typecheck`: PASS
- `npm test`: PASS — 497 tests
- `npm run build`: PASS
- `npm run test --workspace @schemawise/web`: PASS — 184 tests
- `npm audit --omit=dev`: PASS — 0 vulnerabilities
- `git diff --check`: PASS
- Prettier parse/check for README, metadata source, docs index, and CI: PASS
- `actionlint 1.7.12 .github/workflows/ci.yml`: PASS
- GitHub Markdown render and local image load: PASS
- Browser responsive/delayed/axe smoke: PASS

PostgreSQL integration was not rerun because it is explicitly outside the
default gate and requires an isolated external database. The existing
integration documentation and tests remain unchanged.

## Final gate

**SCHEMAWISE: READY AFTER MANUAL PUBLICATION STEPS**

The repository is ready to publish. The gate is not `PORTFOLIO READY` yet only
because the clean URL, two-Origin transition, first public CI run, and final
post-alias browser validation require coordinated external changes after push.
