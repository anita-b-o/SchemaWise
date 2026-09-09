# SchemaWise

SchemaWise is a React/Fastify/PostgreSQL application for explaining relational
schema analysis and normalization. Its deterministic TypeScript engine remains
independent of Web, HTTP, persistence, and authentication.

## Development

Requirements: Node.js 22 (see `.nvmrc`), npm, and PostgreSQL for integration
tests and persisted projects.

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run typecheck
npm test
```

Run Web and API using the environment templates and the local tooling of your
choice; importing the API does not start a listener or run migrations.

## Database migrations

```bash
npm run db:migrate --workspace @schemawise/api
npm run db:rollback --workspace @schemawise/api
```

Production migrations are a reviewed pre-deploy step. Roll-forward is preferred
after traffic; see [migration policy](docs/deployment/migrations.md).

## Build and start

```bash
npm run build
npm start --workspace @schemawise/api
```

The Web artifact is `apps/web/dist`; the API artifact is `apps/api/dist` and its
runtime/release bundle must also retain `apps/api/migrations`.

## Test

```bash
npm run typecheck
npm test
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/TEST_DATABASE \
  npm run test:integration --workspace @schemawise/api
npm run build
```

Deployment v1 is designed but intentionally not provisioned. Start with the
[deployment architecture](docs/deployment/deployment-architecture-v1.md) and
[verification checklist](docs/deployment/deployment-checklist.md). The API must
remain at exactly one replica until its in-memory Auth rate limiter gains a
shared store.
