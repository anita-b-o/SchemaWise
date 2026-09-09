# Deployment architecture

SchemaWise v1 deploys the Vite output as static Web content, one Node 22 Fastify
API process, and a separate managed PostgreSQL database in each environment.
Web and API use distinct origins under the same registrable domain so the
current host-only `SameSite=Lax` session cookie remains valid without widening
cookie scope. Credentialed CORS allowlists only the exact Web origin.

The API exposes unauthenticated `/health` for process liveness and `/ready` for
a sanitized PostgreSQL `SELECT 1` readiness check. Startup validates all runtime
configuration before creating the pool/server. Migrations are a release step;
shutdown drains Fastify and closes the pool.

The API is explicitly limited to one replica because Auth rate-limit state is
in-memory. A shared limiter is required before horizontal scaling.

The authoritative operational design is in
[`docs/deployment/deployment-architecture-v1.md`](../deployment/deployment-architecture-v1.md)
and [ADR 015](../adr/015-deployment-topology.md).
