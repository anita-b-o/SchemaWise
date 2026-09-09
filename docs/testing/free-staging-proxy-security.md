# Free staging proxy security verification

The local suite demonstrates the code-level properties required by ADR 016.
It does not claim provider deployment behavior.

## Covered properties

- HMAC v1 success and binding failures for secret, IP, method, path and query;
  malformed/missing fields; equal-length constant-time comparison path; future
  and expired timestamps with boundary coverage.
- IPv4, IPv4-mapped IPv6 and IPv6 `/64` normalization; malformed, list and
  whitespace inputs rejected.
- Browser assertion replacement, fixed upstream URL, query/method/body relay,
  Origin/Referer/Cookie/CSRF relay, hop-by-hop filtering, status/body/204,
  Retry-After/Cache-Control/Location and independent multiple Set-Cookie.
- Sanitized one-attempt 502 on upstream failure, with no secret, identity,
  cookie, CSRF or body exposure.
- Fail-closed direct Render policy for register, login, me and Project reads or
  writes. Computational routes, health and database readiness remain direct.
- Verified same/different-IP buckets, spoofed X-Forwarded-For ignored, IPv6
  grouping, canonical email+IP and register-IP limits, with rate limiting before
  the Auth use case.
- A real TCP and PostgreSQL chain executes browser-like register, relayed secure
  Set-Cookie, me, CSRF project save and logout through the proxy and Fastify.

## Commands and result

```bash
npm run typecheck
npm test
npm run build
DATABASE_URL=<isolated-local-postgres> npm run test:integration --workspace @schemawise/api
git diff --check
npm audit --omit=dev
```

At acceptance, 396 unit/component tests and 29 PostgreSQL integration tests
pass (425 total). Of these, 39 directly exercise the new proxy/security path.
OpenAPI YAML parsing also passes. No cloud resource, deployment, push or real
staging secret was used.

Post-deploy gates are maintained in
[`staging-smoke.md`](../deployment/staging-smoke.md).
