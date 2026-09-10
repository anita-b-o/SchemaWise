# ADR 016: Free staging topology

Status: **Accepted**

## Decision

Use Vercel Hobby `*.vercel.app` as the sole browser origin, Render Free as the API origin and Neon Free as an isolated disposable database. Browser calls are `/api/v1/...`, never a Render URL. Keep `schemawise_session` host-only: `HttpOnly; Secure; SameSite=Lax; Path=/`, no `Domain`.

Reject a declarative Vercel external rewrite as final authenticated proxy. It can transparently route `/api/:path*` to `https://<render-service>.onrender.com/api/:path*`, but no reviewed contract makes that hop a server-authenticated carrier for the client identity required by existing auth IP limits.

Use the Node.js Vercel Function at `apps/web/api/proxy.ts` with the explicit same-application `/api/v1/(.*)` to `/api/proxy` rewrite in `apps/web/vercel.json`. Vercel's Vite preset does not give `[...path].ts` the multi-segment catch-all semantics provided by Next.js. The Vercel project root is `apps/web`; monorepo source inclusion must remain enabled so the Function can import `@schemawise/proxy-assertion`. It:

1. receive the browser request at the Vercel hostname;
2. derive IP only from Vercel's documented sanitized `x-vercel-forwarded-for` (Vercel documents that it overwrites `X-Forwarded-For` to prevent spoofing and exposes `x-vercel-forwarded-for` as its copy);
3. forward method/body/cookie/Origin/Referer to fixed Render origin and relay status/body/all `Set-Cookie` values;
4. sends an HMAC-SHA-256 assertion binding canonical IP, Unix timestamp, method and exact path/query with a symmetric 60-second validity window, using server-only `STAGING_PROXY_SECRET`; and
5. make API verification mandatory before IP-based rate-limit identity is used.

## Consequences

The visible API response is same-origin. A preserved host-only Set-Cookie without `Domain` is evaluated for the visible Vercel response host, not the hidden Render upstream. `credentials: "include"` remains correct. Same-origin fetch does not need browser CORS enforcement, but exact CORS allowlist remains because API Origin/Referer policy reuses it. The Function must preserve Origin/Referer and real deployment confirms it. Do not base security on `Host`.

Render `CF-Connecting-IP` was approved for direct browser→Render but is not approved after Vercel: it can identify the Vercel hop. Free staging uses `CLIENT_IP_MODE=vercel-proxy`, never `render`; `trustProxy=false` remains. All Auth and Project routes reject missing, invalid, expired or request-mismatched assertions with generic `403 INVALID_PROXY_ASSERTION`. There is no fallback identity. Health/readiness and anonymous computational routes stay directly accessible.

## Accepted implementation evidence

- `@schemawise/proxy-assertion` is the single canonicalization/signing/verification implementation used by Web and API. IPv4-mapped IPv6 becomes IPv4 and native IPv6 is grouped to `/64`, matching rate-limit identity.
- Browser assertion headers are removed and replaced. The relay filters hop-by-hop, Host and Content-Length headers, preserves browser Origin/Referer/Cookie/CSRF, buffers the bounded API exchange, and uses `Headers.getSetCookie()` plus independent appends.
- The rewrite uses an unnamed wildcard, preserving the original visible path/query without an injected named route parameter. Only `api/proxy.ts` remains under `api/`; proxy helpers and tests are non-public modules under `server/proxy`.
- Fastify verifies once in an `onRequest` hook for Auth/Projects, caches the canonical identity on that request, then provenance and auth rate-limit pre-handlers run before the use case. The three existing buckets resolve only that verified identity.
- Unit and real local PostgreSQL proxy-chain tests cover request binding, expiry, malformed/spoofed values, direct Render policy, rate-limit isolation, response fidelity, multiple cookies, register/me/project/logout and security regression.

Replay inside the 60-second window is accepted because the assertion transports rate-limit identity only; it neither authenticates a user nor authorizes an operation. No nonce store is added. A static secret header in `vercel.json` is not equivalent. Provider behavior listed in the staging smoke remains a post-deploy operational gate, not a blocker to provisioning.
