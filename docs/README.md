# SchemaWise technical documentation

The root [README](../README.md) is the public product entry point. This index
routes maintainers to the current technical decisions without deleting the
historical specifications and audit trail that explain how the product evolved.

## Current system

- [Architecture overview](architecture/overview.md)
- [Normalization engine v1](architecture/normalization-engine-v1.md)
- [HTTP application boundary](architecture/http-adapter.md)
- [Authentication and ownership](architecture/authentication-ownership.md)
- [Vercel-to-Render signed proxy](architecture/vercel-render-proxy.md)
- [Deployment configuration](deployment/configuration.md)

## Current product and UX decisions

- [Educational UX v1.1](frontend/educational-ux-v1.1.md)
- [Project recovery v1.2](frontend/project-recovery-v1.2.md)
- [Schema visualization model](frontend/schema-visualization-model.md)
- [UX simplification v1.4](frontend/ux-simplification-v1.4.md)
- [Visualization rendering ADR](adr/018-schema-visualization.md)

## Verification and release evidence

- [Product and portfolio audit](testing/schemawise-product-portfolio-audit.md)
- [Portfolio publication audit](testing/schemawise-portfolio-publication-audit.md)
- [v1 staging audit](testing/schemawise-v1-staging-audit.md)
- [UX simplification staging audit](testing/ux-simplification-v1.4-staging-audit.md)

## Historical baselines

Documents explicitly labelled **historical**, **baseline**, or **superseded**
are retained as decision history. They should not be read as the current
capability or deployment contract. In particular:

- [Original MVP requirements](requirements/MVP.md)
- [Frontend MVP proposal](frontend/frontend-mvp.md)
- [Workspace UX baseline](frontend/workspace-ux.md)
- [Frontend API integration baseline](frontend/api-integration.md)
