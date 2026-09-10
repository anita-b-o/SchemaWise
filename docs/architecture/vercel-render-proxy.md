# Vercel to Render authenticated proxy

The Vite project's single Node.js Function at `apps/web/api/proxy.ts` owns
same-origin `/api/v1/*` through the explicit rewrite in
`apps/web/vercel.json`. Vercel's Vite preset maps `api/[...path].ts` as a
single-segment dynamic route, not as the Next.js-style catch-all its name
suggests. The rewrite therefore uses the documented unnamed wildcard source
`/api/v1/(.*)` and a stable `/api/proxy` destination. An unnamed capture is
intentional: Vercel does not append a route parameter to the original query,
so the Function observes and signs the browser-visible path and query exactly.

The entrypoint forwards only to the server-side
`RENDER_API_ORIGIN`; callers cannot choose an upstream. Hosted origins must be
HTTPS serialized origins without credentials, path, query or fragment.
Helpers and tests live under `apps/web/server/proxy`; only the entrypoint lives
under `api/`, because every source file there is a potential Function. A direct
request to the internal `/api/proxy` path is rejected by the handler before an
upstream request is made.

## Trusted identity and assertion

Vercel documents `x-vercel-forwarded-for` as identical to the public client IP
in its spoofing-resistant, overwritten `x-forwarded-for` value. The Function
requires exactly one valid value: no list and no surrounding whitespace. The
shared `@schemawise/proxy-assertion` package canonicalizes IPv4, IPv4-mapped
IPv6 and native IPv6 `/64` before both signing and rate-limit use.

The Function removes all browser-supplied assertion fields and sets:

```text
X-SchemaWise-Proxy-Ip: <canonical-ip>
X-SchemaWise-Proxy-Timestamp: <unix-seconds>
X-SchemaWise-Proxy-Signature: <base64url HMAC-SHA-256>
```

The exact UTF-8 signing material is:

```text
schemawise:proxy-ip:v1\n
<timestamp>\n
<UPPERCASE METHOD>\n
<path-and-query>\n
<canonical-ip>
```

Both services hold the same server-only `STAGING_PROXY_SECRET`, with at least
32 bytes of independently generated entropy. The API accepts timestamps within
plus or minus 60 seconds and compares the 32-byte decoded signature with
`timingSafeEqual`. Replay inside that window is accepted because this assertion
only transports rate-limit identity; session cookies and CSRF still authorize
the request.

## API policy and relay

With `CLIENT_IP_MODE=vercel-proxy`, all `/api/v1/auth/*` and
`/api/v1/projects*` requests (except OPTIONS) require a valid assertion in the
earliest `onRequest` hook. Missing, malformed, expired or request-mismatched
assertions return generic `403 INVALID_PROXY_ASSERTION`, with no fallback to
the socket, `CF-Connecting-IP`, `X-Forwarded-For`, or `X-Real-IP`. Computation,
`/health`, and `/ready` remain directly reachable.

The Function preserves method, exact path/query, body, Content-Type, Accept,
Origin, Referer, Cookie and X-CSRF-Token. It removes assertion, inbound client
IP metadata, hop-by-hop, Host, Accept-Encoding and Content-Length fields and
lets Fetch regenerate transport metadata.
Responses preserve upstream status and body, including bodyless 204, plus
end-to-end headers such as Content-Type, Cache-Control, Retry-After and
Location. Fetch-decoded Content-Encoding is removed. `Headers.getSetCookie()` retrieves every cookie independently and
each value is appended without parsing or attribute rewriting. Exchanges are
buffered; SchemaWise API request bodies are capped at 64 KiB and responses are
small. There is no application timeout, retry, body/header logging, or stack
exposure. Fetch/response-read failure becomes a sanitized 502.

The Function declares the current Hobby maximum duration of 300 seconds; the
active plan limit and Render cold-start compatibility remain deployment gates.

Official contracts: [Vercel request headers](https://vercel.com/docs/headers/request-headers), [Vite Functions](https://vercel.com/docs/frameworks/frontend/vite), [Functions API](https://vercel.com/docs/functions/functions-api-reference), and [monorepo source inclusion](https://vercel.com/docs/monorepos/monorepo-faq).
