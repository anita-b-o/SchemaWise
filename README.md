# SchemaWise

SchemaWise is a deterministic, interactive workspace for database students to analyze relational schemas, understand why normalization rules pass or fail, and compare valid 3NF and BCNF transformations.

[Open the public demo][live-demo]

![SchemaWise editor and compact normalization analysis](docs/assets/screenshots/schemawise-editor-analysis.png)

## What it does

Define a relation and its functional dependencies → analyze it → understand the evidence → visualize the schema → compare transformations.

SchemaWise keeps the user's schema at the center of the explanation. A built-in example demonstrates the complete anonymous workflow in about a minute, without requiring an account.

## Why I built it

Normalization calculators often return an answer without showing why it follows. SchemaWise combines a deterministic domain engine with progressive educational disclosure so a student can check an answer, inspect the relevant evidence, and then read the formal rule without leaving the schema they entered.

## Core capabilities

- Candidate keys and prime attributes
- Minimal cover
- 2NF, 3NF, and BCNF analysis with violation evidence
- Attribute closure
- Dependency-preserving 3NF synthesis
- Lossless BCNF decomposition
- Explicit dependency-preservation analysis for a decomposition

## Educational UX

Results follow a three-level path: **Result → Explain → Formal reasoning**. Formal explanations use a consistent **Rule → Evidence → Conclusion** structure and distinguish observed results from algorithmic guarantees.

Every contextual claim comes from the API result, its immutable input snapshot, or a documented operation contract. The browser does not rediscover keys, covers, normal forms, or transformations.

![SchemaWise formal Rule, Evidence, and Conclusion reasoning](docs/assets/screenshots/schemawise-formal-reasoning.png)

## Schema visualization

The diagram presents entered dependencies, composite determinants, candidate keys, violations, and generated relations while retaining a complete text equivalent. SchemaWise uses semantic HTML/CSS instead of a heavy graph engine: with a maximum of six attributes, deterministic reflow and accessible controls matter more than free-form pan and zoom.

![SchemaWise visualization preserving a composite functional dependency](docs/assets/screenshots/schemawise-composite-fd-visualization.png)

## Transformations

3NF synthesis and BCNF decomposition remain separate, explicit operations. The interface presents their different guarantees, the returned relations, BCNF split evidence, and a separate dependency-preservation check.

| 3NF and BCNF results                                                                                               | Dependency preservation                                                                                      |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| ![SchemaWise 3NF synthesis and BCNF decomposition results](docs/assets/screenshots/schemawise-transformations.png) | ![SchemaWise dependency preservation result](docs/assets/screenshots/schemawise-dependency-preservation.png) |

## Architecture

```text
React + TypeScript + Vite
          │
          ▼
Vercel Web + signed same-origin proxy
          │
          ▼
Fastify + TypeScript API on Render
          │                 │
          ▼                 ▼
independent TypeScript    PostgreSQL on Neon
normalization engine
```

The normalization engine is independent of React, HTTP, persistence, and authentication. Web responses carry the completed analysis snapshot; the UI formats and explains that snapshot without recomputing domain results.

## Security and data integrity

The authenticated project surface uses:

- host-only `HttpOnly`, `Secure`, `SameSite=Lax` session cookies;
- Argon2id password hashing;
- session-bound CSRF tokens plus exact Origin/Referer validation;
- owner-scoped project access;
- optimistic concurrency control for project updates;
- a signed Vercel-to-Render identity assertion for protected routes; and
- rate limits on authentication endpoints.

This is a portfolio/demo architecture on free infrastructure, not a production SLA or a claim of production-service readiness.

## Testing

The default suite currently contains **497 tests**: **140 API**, **184 Web**, and **173 normalization engine** tests. The number is supporting evidence, not a quality proxy; the suite focuses on mathematical edge cases, deterministic ordering, stale snapshots, request replacement, accessible disclosures, ownership/OCC, CSRF and proxy boundaries, and failure recovery.

```bash
npm run typecheck
npm test
npm run build
```

PostgreSQL integration tests are intentionally separate from `npm test` because they require an isolated database:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/TEST_DATABASE \
  npm run test:integration --workspace @schemawise/api
```

## UX iteration with measured evidence

SchemaWise v1.4 reduced repeated explanations, moved detail behind progressive disclosure, and strengthened result hierarchy. For the same audited analyzed state, the Results column fell from **1,750 to 1,114 px on desktop (−36.3%)** and from **2,199 to 1,504 px on mobile (−31.6%)**, while keeping the essential answers visible.

## Tech stack

- React 19, TypeScript, Vite
- Fastify 5 and Node.js 22
- Independent TypeScript normalization engine
- PostgreSQL with `pg` and reviewed migrations
- Vitest and Testing Library
- Vercel Hobby → Render Free → Neon Free

## Run locally

Prerequisites: Node.js 22, npm, and PostgreSQL for the API, persisted projects, and integration tests.

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

In `apps/api/.env`, use a local PostgreSQL URL, set `CLIENT_IP_MODE=direct`, and replace `CSRF_SECRET` with at least 32 bytes of random secret material. In `apps/web/.env.local`, set `VITE_SCHEMAWISE_API_URL=http://127.0.0.1:3000`. Do not commit either file.

Build the engine and API, migrate the local database, and start Fastify:

```bash
npm run build --workspace @schemawise/normalization-engine
npm run build --workspace @schemawise/api
npm run db:migrate --workspace @schemawise/api -- --envPath .env
node --env-file=apps/api/.env apps/api/dist/main.js
```

In a second terminal, start the Web app with the installed Vite binary:

```bash
npm exec --workspace @schemawise/web vite -- --host 127.0.0.1
```

For a release build, run `npm run build`. The Web artifact is `apps/web/dist`; the API artifact is `apps/api/dist`, and the API release bundle must retain `apps/api/migrations`.

## Free-tier demo limitations

- Educational schemas are limited to 6 attributes and 12 entered functional dependencies.
- 1NF is assumed; SchemaWise does not detect it.
- The Render service may sleep, so the first operation can take longer while the demo wakes.
- There is no SQL import, live database introspection, or ER modeling.
- The public demo has no production availability or durability SLA.

## Project status

The intended v1 product scope is complete. The repository is in publication polish; the current public demo URL remains the existing staging alias until the clean Vercel alias and matching Render allowlist transition are validated together.

## Selected technical docs

1. [Architecture overview](docs/architecture/overview.md)
2. [Normalization engine contracts](docs/architecture/normalization-engine-v1.md)
3. [Educational UX](docs/frontend/educational-ux-v1.1.md)
4. [Visualization decision](docs/adr/018-schema-visualization.md)
5. [Authentication and ownership](docs/architecture/authentication-ownership.md)
6. [Project recovery](docs/frontend/project-recovery-v1.2.md)
7. [Vercel-to-Render proxy](docs/architecture/vercel-render-proxy.md)
8. [Portfolio publication audit](docs/testing/schemawise-portfolio-publication-audit.md)

[live-demo]: https://schemawise-staging.vercel.app
