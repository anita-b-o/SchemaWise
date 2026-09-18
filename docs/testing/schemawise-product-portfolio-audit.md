# SchemaWise product and portfolio audit

- Date: 2026-09-18
- Environment: public staging plus read-only repository review
- Product verdict: **READY AFTER SMALL FIXES**
- Public demo verdict: **READY WITH FREE-TIER LIMITATIONS**
- Production verdict: **NOT PRODUCTION READY**
- Development decision: **ONE SMALL POLISH PASS — then publish**

## Decision

SchemaWise is functionally and educationally complete for its intended job:
define a small relation and functional dependencies, analyze normalization,
understand the result, visualize the evidence, and compare valid 3NF and BCNF
transformations. No missing core capability justifies another feature tranche.

The product should not yet be presented through the current `staging` URL and
minimal repository landing experience without a small publication pass. That
pass is packaging and demo-resilience work, not continued product development.

## Evidence reviewed

- Real anonymous staging exercise at 320x720, 390x844, 768x1024 and 1440x900.
- Case `R(A,B,C)`, `A -> B`, `B -> C`: candidate key `{A}`, prime attribute
  `{A}`, 2NF satisfied, 3NF and BCNF violated by `B -> C`, minimal cover shown.
- Explain and Formal reasoning, schema diagram, 3NF synthesis, BCNF
  decomposition, dependency preservation and attribute closure.
- Invalid/missing input, duplicate dependency, stale snapshot, simulated
  network failure and explicit retry.
- Anonymous project/auth entry points and the approved v1.2 recovery evidence.
- Engine, Web, API, security, deployment, architecture and testing documents.
- Current local validation: 493 tests passed (140 API, 179 Web, 174 Engine),
  typecheck passed, and runtime dependency audit reported 0 vulnerabilities.
- Current staging headers and documented Vercel/Render/Neon free-tier behavior.
- A small sample of current normalization calculators and learning tools.

No production code, configuration, service, data or secret was changed.

## Product findings

### Core experience

`Load example` is sufficient onboarding for the target user. It teaches the
input model and leads directly to Analyze. The default result answers the key
questions without opening help; progressive disclosure adds intuition and then
formal Rule/Evidence/Conclusion reasoning.

Mathematical boundaries are unusually well handled for an educational tool:
candidate key is not called primary key; prime is not called primary; 1NF is an
assumption; 3NF and BCNF use their distinct rules; lossless join and dependency
preservation are separate; guarantees are separated from independently checked
results; stale snapshots are not mixed with edited input.

Visualization is **valuable**, not essential. Semantic HTML/CSS is the right
decision for the six-attribute scope: it preserves composite determinants,
works without pan/zoom, remains accessible and keeps layout deterministic.

Projects add legitimate repeat-study value but are secondary. Anonymous users
can demonstrate every educational capability; opening Projects or Save clearly
offers sign-in without discarding the workspace.

### Responsive and accessibility

- 320px: usable, cramped and long; not comfortable or optimized.
- 390px: usable for a small exercise; not the preferred deep-study surface.
- 768px: comfortable single-column transition, with some generous whitespace.
- 1440px: strongest experience; the 34/66 split and sticky result context work.
- No horizontal overflow was found in the tested viewports.
- The default 390px analyzed page measured 4,265px, matching the v1.4 audit.
- Native controls, focus behavior, live errors, disclosure semantics and textual
  diagram equivalents are integrated. Prior audited states had 0 axe
  violations; attended screen-reader and physical-device checks remain
  explicitly deferred.

### Failure and free-tier behavior

Input errors are specific and block invalid requests. A failed analysis retains
the draft and prior result, reports a safe retryable error, and recovers without
reload. Editing analyzed input marks results `Out of date` and disables unsafe
transformations.

Warm staging analysis completed in roughly 0.24-1.2 seconds during this audit.
A forced slow response showed correct busy/disabled behavior, but only generic
`Analyzing the schema...` copy. Render Free can sleep after inactivity and its
documented wake-up can take about a minute. A delayed message explaining that
the public demo server is waking is required publication polish.

## Portfolio assessment

The project demonstrates more than a calculator:

1. A deterministic domain engine with bounded exhaustive algorithms.
2. Educational content layered from result to intuition to formal evidence.
3. A no-recomputation frontend that presents API snapshots safely.
4. Accessible composite-dependency and transformation visualization.
5. Authenticated persistence with ownership, OCC and recovery states.
6. A signed same-origin Vercel-to-Render proxy and disciplined session/CSRF
   boundary.
7. Evidence-driven simplification: Results height fell 36.3% on desktop and
   31.6% on mobile while preserving essential answers.

The current README is not yet a strong public repository entry point. It lacks
the live demo, screenshots, user-facing feature summary, concise architecture,
case-study evidence and current limitations. Some internal documents still use
obsolete future tense or older limitations, and the engine retains one vacuous
baseline test named as if algorithms were not implemented. These do not affect
the product, but they weaken recruiter confidence if left unexplained.

## Publication gate

### Must fix before portfolio

1. **Cold-start expectation** — add delayed, specific demo wake-up copy while
   preserving the existing retry/error behavior.
2. **Public presentation surface** — use a clean public Vercel alias without
   `staging`, and point portfolio links to it.
3. **Repository landing page** — make README the public entry point with a clear
   product statement, live demo, 3-5 screenshots, architecture, verified test
   context, local setup and honest limitations.

### Should fix, maximum five

1. Add description/Open Graph metadata and a share image for direct links.
2. Reconcile or clearly archive stale internal docs; remove the vacuous engine
   baseline test.
3. Add CI for default tests, typecheck and build so the public test claim is
   continuously verifiable.
4. Run one attended screen-reader and one physical-phone smoke when available.
5. Add a small curated examples library after publication if usage supports it.

## Scope and feature decisions

SchemaWise is an interactive educational workspace for small relational schemas
defined by attributes and functional dependencies. It is not an ER modeler,
SQL/database introspector, enterprise design suite, automatic optimizer,
general-purpose theorem prover or AI product.

| Capability | Decision |
| --- | --- |
| Examples library | SHOULD |
| Exportable report | LATER |
| Bilingual English/Spanish | LATER |
| Share links | LATER |
| Persisted analysis | LATER |
| Project search/pagination | LATER |
| Quizzes/exercises | LATER |
| SQL/schema import | DO NOT BUILD now |
| PDF-specific export | DO NOT BUILD now |
| Guided tour/wizard | DO NOT BUILD |
| Dark mode | DO NOT BUILD now |
| Autosave | DO NOT BUILD now |
| ER diagrams / SQL generation | DO NOT BUILD |
| AI explanations | DO NOT BUILD |
| Teacher mode | DO NOT BUILD |
| 4NF/5NF | DO NOT BUILD now |
| Broad performance work | DO NOT BUILD for the bounded v1 scope |

## Positioning

**Product:** SchemaWise is a deterministic, interactive workspace for database
students to analyze relational schemas, understand why normalization rules pass
or fail, and compare valid 3NF and BCNF transformations.

**Portfolio title:** SchemaWise — Interactive Relational Normalization Workspace

**One line:** A full-stack educational tool that turns functional dependencies
into explainable normalization analysis, accessible diagrams and safe
transformations.

Do not claim production-ready SaaS, enterprise database design, SQL/database
introspection, automatic optimization, AI assistance, 1NF detection, guaranteed
BCNF dependency preservation, unlimited schema scale, universal WCAG
certification or always-on availability.

## Recommended recruiter demo

1. `Load example`.
2. `Analyze schema`; point out `{A}`, 2NF pass and the single `B -> C` issue.
3. Open `Explain issue` to show the distinct 3NF and BCNF rules.
4. `Show in diagram` to connect evidence to the relation.
5. Generate 3NF synthesis, then BCNF decomposition and check preservation.

This demonstrates the complete product in 60-120 seconds without an account.

## Production distinction

Portfolio readiness does not imply production-service readiness. Production
still needs tested security headers/CSP, distributed rate limiting before more
than one API instance, production-grade backups and restore practice,
monitoring/alerting, capacity testing, an availability objective and a
non-sleeping deployment appropriate to that objective.

## Final recommendation

Complete one small, tightly scoped publication pass; then stop feature
development and publish. The next product feature should be driven by observed
student use, not by the need to make the portfolio project appear larger.
