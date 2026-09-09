# Deployment architecture v1

Status: approved design; not deployed.

## Topology decision

SchemaWise v1 uses a static Web deployment and one persistent API process backed
by one managed PostgreSQL database per environment:

```text
Browser
  -> HTTPS -> static Web host (app.schemawise.example)
  -> HTTPS -> Node 22 / Fastify API (api.schemawise.example, exactly 1 replica)
             -> TLS or provider private network -> PostgreSQL
```

Production should use `app.schemawise.example` (or the apex domain) for Web and
`api.schemawise.example` for API. Staging should use
`staging.schemawise.example` and `api.staging.schemawise.example`. The exact
domain will be chosen later; these names express the required relationship.

This is cross-origin but same-site. It preserves the current host-only,
`Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` API cookie: the browser sends the
cookie only to the API hostname and the Web client already uses
`credentials: include`. The API allowlists the one exact Web origin and accepts
`X-CSRF-Token`. No cookie `Domain` or `SameSite=None` is needed.

Unrelated provider domains are not an acceptable authenticated production
topology because they are cross-site and a Lax cookie is not available to
cross-site `fetch`. Until custom domains exist, an environment must instead use
a same-origin reverse proxy. A reverse proxy reduces CORS surface but couples
Web routing to API availability and must preserve cookies and forwarded client
metadata. Distinct same-site subdomains are preferred because ownership and
operational boundaries remain explicit.

`VITE_SCHEMAWISE_API_URL` is embedded at Web build time. It is the environment's
absolute API origin; staging and production therefore use different Web
artifacts.

## Runtime and artifacts

- Node is pinned to major 22 (`.nvmrc` and hosting runtime configuration).
- Root build: `npm run build`.
- Web build: `npm run build --workspace @schemawise/web`; publish
  `apps/web/dist` with HTTPS, long immutable caching for hashed assets, and
  revalidation/no aggressive caching for `index.html`. Only `/` exists, so an
  SPA fallback is not currently required.
- API build: `npm run build --workspace @schemawise/api`; output is
  `apps/api/dist`.
- API start: `npm start --workspace @schemawise/api`, with `HOST=0.0.0.0` and the
  platform-provided `PORT`.
- The release environment must retain `apps/api/migrations/*.cjs` and
  `node-pg-migrate`; TypeScript compilation does not copy them into `dist`.
- The Git commit SHA identifies every release. Record it in deployment metadata
  and startup/platform logs; no public version endpoint is added in v1.

## Provider capabilities required

The Web provider must support static artifacts, HTTPS, build-time variables and
optional custom domains. The API provider must support a persistent Node 22
process, HTTPS/proxying, secret environment variables, an explicit pre-deploy
command, HTTP health checks and an enforced replica count of one. PostgreSQL
must support TLS, backups, restore, connection limits, migrations and preferably
private networking to the API.

## Provider recommendation

Recommended initial split: Vercel for the Vite static Web, Render for the single
Fastify Web Service, and Neon managed PostgreSQL. It keeps each component close
to its natural hosting model and is suitable for a low-traffic portfolio/demo.
Use paid tiers wherever production backup retention, non-sleeping API behavior
or availability guarantees require them; free-tier behavior is not a production
SLA.

Trade-offs are three control planes, three cost models and custom-domain work.
The simpler alternative is Render for static Web, API and PostgreSQL, accepting
less provider specialization. A Vercel + Railway API/database layout is also
viable but does not materially simplify the current release procedure. No
provider account or resource is created in this iteration.

This recommendation was checked against current official documentation for
[Vite builds on Vercel](https://vercel.com/docs/frameworks/frontend/vite),
[Render pre-deploy commands](https://render.com/docs/deploys),
[Render HTTP health checks](https://render.com/docs/health-checks), and
[Neon restore windows](https://neon.com/docs/manage/projects). Render's
pre-deploy command is a paid-service capability; staging on a free service would
need a separately controlled manual migration step and must not silently move
migrations into API startup.

The chosen provider does not relax these application constraints: one API
replica, exact origins, same-site hostnames, migration release step, verified DB
TLS, and backups.

## Security headers

Security headers are deferred to hosting configuration, not considered a launch
blocker for this code tranche. Before public production, configure at least
`X-Content-Type-Options: nosniff`, a restrictive `Referrer-Policy`, and frame
protection (`frame-ancestors` in CSP, with `X-Frame-Options: DENY` as legacy
coverage). Start with a measured CSP for the static app after observing its
actual asset/connect requirements; do not ship an untested policy. Helmet or a
larger application security-header overhaul is unnecessary for v1.

See [ADR 015](../adr/015-deployment-topology.md),
[environments](environments.md), [configuration](configuration.md), and the
[deployment checklist](deployment-checklist.md).
