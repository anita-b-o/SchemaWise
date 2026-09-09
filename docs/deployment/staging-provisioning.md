# Staging provisioning plan

Status: **ready for provisioning**; no cloud resource, DNS record, secret, or
deployment has been created. Provisioning still requires the human choices at
the end of this document.

In this document, `<domain>` means a controllable SchemaWise base domain or
delegated subdomain. It is not evidence that a domain has been purchased.

## Topology and same-site decision

Use distinct, same-site custom origins:

```text
Browser
  -> HTTPS -> staging.<domain> -> Vercel project schemawise-web-staging
  -> HTTPS -> api.staging.<domain> -> Render Web Service schemawise-api-staging
                                        -> verified TLS -> Neon schemawise-staging
```

This is option A when `<domain>` is the delegated SchemaWise base (for example,
`schemawise.example.com`). The Web and API are cross-origin but schemefully
same-site because both use HTTPS and have the same registrable parent domain.
The existing host-only, `Secure`, `HttpOnly`, `SameSite=Lax` cookie therefore
works without a `Domain` attribute or `SameSite=None`.

This is simpler than option C with Vercel and Render: no rewrite layer, no
cookie rewriting, and no extra proxy hop whose forwarded headers must be
trusted. Option B has no technical benefit. Option D is rejected: provider URLs
are cross-site and changing auth to `SameSite=None` merely to avoid DNS is not
acceptable.

No owned domain is named in the repository. External requirement: **Need a
controllable domain or delegated subdomain.** Until one exists, provider URLs may be used
only for unauthenticated infrastructure checks, not as the final authenticated
staging topology or auth smoke target.

## Region

Provision the Render API in **Virginia** and the Neon project in **AWS US East
(N. Virginia), `us-east-1`**. Render has no South America region, while Neon does;
putting Neon in São Paulo would improve direct user-to-database geography but
would make every API query cross regions. The API-to-database path is the
latency-sensitive repeated path, so matching Virginia is the better system
choice. Vercel serves the static Web through its CDN and does not drive this
decision.

Render currently offers Virginia, Ohio, Oregon, Frankfurt, and Singapore.
Neon supports N. Virginia and other AWS regions including São Paulo. Region is
costly to change later, so confirm both selectors immediately before creation.

Sources: [Render regions](https://render.com/docs/regions), [Neon regional
status](https://neon.com/docs/introduction/status), [Neon São Paulo
availability](https://neon.com/docs/changelog/2025-02-28).

## Provider configuration

### Vercel

- Create a separate project, conceptually `schemawise-web-staging`. Do not reuse
  a future production project or its environment variables.
- Project/root directory: repository root.
- Framework preset: Vite.
- Install command: `npm ci`.
- Build command: `npm run build --workspace @schemawise/web`.
- Output directory: `apps/web/dist`.
- Node.js major: 22.
- Production-scoped build variable in this staging-only project:
  `VITE_SCHEMAWISE_API_URL=https://api.staging.<domain>`.
- Bind `staging.<domain>` to the project's Production environment. For this
  subdomain, create the CNAME target Vercel reports from domain inspection; the
  current general-purpose target is `cname.vercel-dns-0.com`, but the
  project-specific instruction is authoritative. Vercel provisions and renews
  HTTPS after DNS verification.
- Keep this as a separate staging project, rather than using Preview variables
  in a shared project. A stable custom hostname, clear secret scope, and a
  production-grade Vite build then belong to one isolated unit.
- Source of truth remains the repository default branch (`master` currently;
  rename is not part of this tranche). Disable automatic custom-domain
  assignment and manually promote a build from a recorded clean commit SHA.
  Do not add a long-lived `staging` branch merely for the provider.

Vercel supports subdomain CNAME binding, automatic certificates, and staged
production promotion. See [custom domain setup](https://vercel.com/docs/domains/set-up-custom-domain),
[monorepos](https://vercel.com/docs/monorepos), and [manual
promotion](https://vercel.com/docs/deployments/promoting-a-deployment).

Minimum plan: Hobby is technically enough for a personal, non-commercial
staging SPA and its custom domain. Use Pro if SchemaWise is commercial, belongs
to a team, needs team controls/support, or violates Hobby fair-use eligibility.

### Render

- Service type: **Web Service**, native Node runtime, Node 22, one instance.
- Name: `schemawise-api-staging`.
- Region: Virginia.
- Root directory: repository root.
- Branch: repository default branch (`master` currently).
- Auto-deploy: off; deploy a recorded commit manually after migration readiness.
- Build command: `npm ci && npm run build --workspace @schemawise/api`.
- Pre-deploy command on the paid service:
  `npm run db:migrate --workspace @schemawise/api -- --database-url-var DATABASE_MIGRATION_URL`.
- Start command: `npm start --workspace @schemawise/api`.
- Health check path: `/ready`.
- Instance count: exactly 1. No worker, cron, persistent disk, or Docker.
- Bind `api.staging.<domain>` in Render, create the CNAME Render specifies
  (normally the service's `*.onrender.com` hostname), verify it, and allow Render
  to issue/renew HTTPS. After verification, disable the default Render subdomain.
- Set `HOST=0.0.0.0`; do not define `PORT`, because Render injects it (default
  expected port 10000).

Use the lowest paid, non-sleeping Web Service size available (Starter-class).
It supplies the pre-deploy command and avoids free-service sleep/cold starts.
Render documents pre-deploy commands as paid-service functionality. If a human
chooses Free despite this recommendation, omit pre-deploy and run the same
migration command once in a controlled one-off shell/job before deploying the
API; never move migrations into startup.

Sources: [Render deploy lifecycle](https://render.com/docs/deploys), [Web
Services](https://render.com/docs/web-services), [health
checks](https://render.com/docs/health-checks), and [custom
domains](https://render.com/docs/custom-domains).

### Neon

- Separate project: `schemawise-staging`.
- Database: `schemawise_staging`; dedicated application/migration role managed
  as a Neon project credential.
- PostgreSQL: **17**, a stable supported major. Do not choose PostgreSQL 18 while
  its Neon support is described as preview.
- Cloud/region: AWS N. Virginia (`us-east-1`).
- One long-lived default branch named conceptually `staging`; no production data,
  no preview branches, no seed data. Protect it if the selected plan exposes
  branch protection. Remove/avoid unused generated development branches.
- Compute: smallest initial autoscaling range; leave scale-to-zero enabled only
  if observation proves the Render `/ready` probe permits it in practice.
- Restore requirement: at least point-in-time/time-travel restore and a window
  long enough to rehearse restoration. Launch is the recommended minimum here,
  with up to seven days; Free offers only up to six hours (and a data-change
  cap), which is acceptable only for disposable staging.

The paid Render service polls `/ready`, and `/ready` executes `SELECT 1`. Frequent
polling can keep Neon compute awake, defeating scale-to-zero and consuming
compute hours. Treat always-awake minimum compute, retained history, storage,
branch-hours, and network egress as cost drivers; verify actual suspension and
usage after staging exists.

Sources: [Neon plans](https://neon.com/pricing), [project/restore window
configuration](https://neon.com/docs/manage/projects), and [Postgres
compatibility](https://neon.com/docs/reference/compatibility).

## Database connections and TLS

Use two URLs for the same Neon branch/database:

- `DATABASE_URL`: pooled hostname containing `-pooler`, used only by the API's
  `pg.Pool`, with `DATABASE_POOL_MAX=5`.
- `DATABASE_MIGRATION_URL`: direct hostname without `-pooler`, used only by the
  pre-deploy/manual migration command.

Neon supports pooling on all plans. A five-client application pool is far below
the pooler's client limit and deliberately leaves direct connection headroom.
Neon recommends direct connections for schema migrations because PgBouncer uses
transaction pooling.

The repository's migration script normally reads `DATABASE_URL`.
`node-pg-migrate` 9 also supports `--database-url-var`; the staging command above
uses that existing CLI option and needs no code change.

Start with the provider-generated URLs, retain `channel_binding=require`, and
use `sslmode=verify-full` for both URLs. Do not use `rejectUnauthorized:false`,
`sslmode=no-verify`, or `uselibpqcompat=true`. The installed
`pg-connection-string` currently treats `sslmode=require` as verified TLS but
warns that the next major will adopt weaker libpq semantics, so spelling out
`verify-full` preserves the intended policy across upgrades.

Sources: [Neon connection pooling](https://neon.com/docs/connect/connection-pooling),
[secure connection strings](https://neon.com/docs/connect/connect-securely), and
[channel binding](https://neon.com/docs/changelog/2025-06-27).

## Migration and first database procedure

1. Provision the separate Neon project/branch/database and obtain both pooled
   and direct URLs from its Connect dialog.
2. Set Render secret variables, but do not start public traffic.
3. From the repository root in Render pre-deploy (preferred), run exactly:

   ```bash
   npm run db:migrate --workspace @schemawise/api -- --database-url-var DATABASE_MIGRATION_URL
   ```

4. The fresh database applies `001_create_projects`, `002_create_users`,
   `003_create_sessions`, then `004_add_project_owner`. Migration 004's empty
   `projects` guard must pass. Do not seed or insert users/projects manually.
5. Using the Neon SQL editor or a controlled direct `psql` session, verify:

   ```sql
   SELECT name, run_on FROM public.pgmigrations ORDER BY run_on, id;
   SELECT count(*) AS projects FROM public.projects;
   SELECT count(*) AS users FROM public.users;
   ```

   Expect four migration rows and zero projects/users. Do not print connection
   URLs in terminal transcripts or logs.
6. Deploy/start the single API only after the migration succeeds. A failed
   migration cancels the paid Render deploy; do not retry concurrently.

For a deliberately selected Render Free service, perform steps 3-5 once in a
controlled shell/job before the API deploy. There is no startup auto-migration.

## Health check

Set Render's HTTP health path to `/ready`. It returns 200 only after a database
`SELECT 1`; a DB outage returns 503, so Render removes/restarts the only instance.
That correctly models readiness, but with one instance it also makes the API
unavailable during a DB outage and may keep Neon awake. `/health` remains the
cheap liveness/diagnostic endpoint checked manually and must return 200 even
when PostgreSQL is unavailable.

## Client IP and trust proxy decision

Render is approved for this one-instance API with `CLIENT_IP_MODE=render` and
Fastify `trustProxy=false`. The application does not use `request.ip` or
`X-Forwarded-For` for auth rate-limit identity in Render mode. It strictly
parses the single `CF-Connecting-IP` value, rejects missing, malformed, or
list-valued metadata, normalizes IPv4/IPv6, and uses that result explicitly for
the login-IP, canonical-email+IP, and register-IP limiters.

Render documents the following relevant public request path and headers:

- all inbound traffic to a Render web service passes through Render's
  Cloudflare edge and Render load balancers; the bound application port is not
  directly reachable from the public internet;
- `CF-Connecting-IP` is written on every request reaching a web service and
  overwrites any value supplied by the caller, making it the approved identity;
- Cloudflare appends to, rather than replaces, `X-Forwarded-For`, so its
  caller-controlled leftmost entry is not an approved security identity; and
- `CF-Ray` is forwarded on every request for tracing, not identity.

The reviewed Render documentation does not publish inbound edge/load-balancer
CIDRs for application `trustProxy`; its documented CIDRs are service **outbound**
addresses and are not usable for this purpose. Nor does it present an exhaustive
contract for every forwarded header. Therefore IP/CIDR `trustProxy`, a custom
Fastify proxy predicate, hop-count trust, and `trustProxy=true` are all rejected.

The alternatives were assessed as follows:

| Option | Decision |
| --- | --- |
| A. Fastify trusted IP/CIDR | Reject: Render publishes no applicable inbound proxy ranges. |
| B. Custom `trustProxy` function | Reject: there is no stable immediate-peer range to validate; hop-only logic is unsafe. |
| C. Provider-specific header | Select `CF-Connecting-IP` only in explicit Render mode, based on Render's overwrite guarantee. |
| D. Socket plus proxy-edge limits | Insufficient alone: the socket identifies the shared proxy, and edge controls do not implement the three application buckets. |
| E. Accept aggregate proxy limits | Reject: one caller could deny authentication to unrelated clients. |
| F. Change API provider/topology | Valid fallback if the Render contract changes or the real smoke contradicts it; not currently required. |

An external Cloudflare DNS proxy is not part of this architecture and is not
required for the decision. Adding one would be a new proxy hop and would require
a fresh client-IP review. Revalidate Render's contract before production.

Sources: [Render client-IP guidance](https://render.com/articles/how-render-handles-ddos-attacks),
[Render proxy-chain guidance](https://render.com/articles/host-pocketbase-on-render),
[Render Web Service networking](https://render.com/docs/web-services), [outbound
IP addresses](https://render.com/docs/outbound-ip-addresses), and [custom-domain
provider URL controls](https://render.com/docs/custom-domains).

## Cookie and CORS configuration

Use exactly:

```text
AUTH_COOKIE_SECURE=true
CORS_ORIGINS=https://staging.<domain>
```

The CORS value has no trailing slash, localhost, provider URL, or production
origin. The Web calls `https://api.staging.<domain>` with credentials. The API
sets the session cookie at the API host with `Secure`, `HttpOnly`,
`SameSite=Lax`, `Path=/`, and no `Domain` attribute.

Generate the independent staging CSRF secret locally and paste it directly into
Render's secret manager; never commit or echo the resulting value:

```bash
openssl rand -base64 48
```

## Provisioning and deployment order

No step below is authorized until the human decisions at the end are resolved.

1. Record the clean candidate commit SHA and re-run the documented release gate.
2. Confirm control of `<domain>`, provider accounts, and the chosen plans.
3. Provision Neon `schemawise-staging` in AWS N. Virginia, PostgreSQL 17; set
   restore window/branch policy and capture pooled/direct URLs in the secret
   manager.
4. Configure the Render paid Web Service with the exact commands and environment
   matrix, one instance, auto-deploy off, and `CLIENT_IP_MODE=render`.
5. Bind `api.staging.<domain>`, create/verify its DNS record, wait for HTTPS, then
   disable the `onrender.com` subdomain.
6. Run the direct-URL pre-deploy migration once and verify `pgmigrations` and
   empty tables.
7. Deploy the API by recorded SHA; require custom-domain `/health` and `/ready`
   200. Do not use the provider hostname for auth acceptance.
8. Configure the separate Vercel staging project and its build-time API URL.
9. Build the recorded SHA, bind `staging.<domain>`, create/verify DNS, wait for
   HTTPS, and manually promote that build to the staging domain.
10. Run the complete staging smoke and inspect Render logs, client-IP behavior,
    Neon usage, and DNS/TLS. A contradiction of the documented client-IP model
    blocks acceptance and triggers the provider/topology fallback.

## Provider URL policy

Disable Render's `*.onrender.com` subdomain after its custom domain is verified;
Render supports this and returns 404 before requests reach the service. The
application port itself is not publicly reachable, so this closes the alternate
provider hostname but is not what makes `CF-Connecting-IP` trustworthy. Vercel's
generated deployment URLs may remain available or be protected when the plan
allows, but they are never allowed in API CORS and are not auth-smoke targets.
The Web artifact still points to the API custom domain; attempting auth from a
`vercel.app` origin must fail CORS/provenance. This is defense in depth, not a
substitute for the custom same-site topology.

## Cost and operational constraints

| Provider | Recommended staging minimum | Main constraints/cost drivers |
| --- | --- | --- |
| Vercel | Hobby only for eligible personal/non-commercial use; otherwise Pro | Team seats/controls, build and transfer limits, deployment protection. Static SPA runtime is small. |
| Render | Lowest paid non-sleeping Web Service (Starter-class), one instance | Instance uptime, pipeline minutes, outbound transfer; Free sleeps after 15 minutes and has no pre-deploy command. One instance means deployment/restart gaps remain an application constraint. |
| Neon | Launch | Compute CU-hours, storage, restore history, branch-hours, egress. `/ready` polling may prevent scale-to-zero. Free's six-hour restore window and included compute are suitable only for disposable staging. |

Do not rely on exact prices in this plan; review each provider's checkout before
creation and set spend alerts/limits where available.

## Production differences

Production is a later, separate operation. It changes Web/API hostnames
(`app.<domain>` or apex and `api.<domain>`), Vercel/Render resources, Neon
project/database/role, both DB URLs, CSRF secret, exact CORS origin, Web build
URL, backup/restore retention, monitoring, and smoke-data policy. Production
should meet the existing minimum of daily backups retained 14 days and at least
seven days PITR/history where supported. Never copy staging credentials or its
smoke account/data into production.

## Required human decisions

1. Identify a controllable domain or delegated subdomain represented by
   `<domain>` and authorize its later DNS records.
2. Identify the Vercel, Render, Neon, DNS, and source-repository accounts/owners.
3. Approve Vercel Hobby versus Pro eligibility, the lowest paid Render Web
   Service, and Neon Launch versus deliberately disposable Free staging.
