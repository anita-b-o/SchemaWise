# Staging smoke checklist

Run only against the verified custom origins:

```text
WEB_ORIGIN=https://staging.<domain>
API_ORIGIN=https://api.staging.<domain>
```

Do not substitute `vercel.app` or `onrender.com` for authenticated checks. Record
the candidate Git SHA, timestamp, browser/version, tester, and pass/fail evidence
without secrets.

## DNS, TLS, and operations

- [ ] Both hostnames resolve only to their intended provider bindings.
- [ ] Web and API load through HTTPS with valid automatically renewed chains;
      HTTP redirects to HTTPS and there is no mixed content.
- [ ] `GET $API_ORIGIN/health` returns 200 and `{ "status": "ok" }`.
- [ ] `GET $API_ORIGIN/ready` returns 200 and `{ "status": "ready" }`.
- [ ] In a controlled DB-unavailable rehearsal if approved, `/health` remains
      live while `/ready` becomes 503; restore connectivity and require 200.
- [ ] Render shows exactly one API instance and the deployed candidate SHA.
- [ ] The Web bundle calls exactly `$API_ORIGIN`, not a provider or localhost URL.

## Anonymous application flow

- [ ] Open the Web with a fresh browser profile and load the built-in example.
- [ ] Run Analyze and inspect keys/normal forms/results.
- [ ] Run 3NF Synthesis.
- [ ] Run BCNF decomposition.
- [ ] Run attribute Closure.
- [ ] Confirm no login is required and no console/network error occurs.

## Authentication

Use a dedicated conceptual address such as `staging-smoke@<controlled-test-domain>`
or a named manual tester account. Do not publish an actual address/password or
commit credentials.

- [ ] Register through UI/API; do not insert the user in PostgreSQL.
- [ ] Confirm `/api/v1/auth/me` returns that user and a session-bound CSRF token.
- [ ] Logout; confirm the session is unusable and the cookie is cleared.
- [ ] Login with the same account; confirm `/me` again.
- [ ] Keep the CSRF token in memory only; confirm it is absent from localStorage,
      sessionStorage, URLs, and cookies.

The application has no delete-user API. That is acceptable for staging smoke:
delete every smoke project, but retain the dedicated account and rotate/disable
its credential operationally if it should no longer be used. Do not delete the
user directly in PostgreSQL merely to make the smoke look clean.

## Project lifecycle

- [ ] Save a new named project; expect revision 1.
- [ ] Modify its schema/name and Save update; expect the revision to increment.
- [ ] Return to the project list, Open it, and confirm persisted contents.
- [ ] Execute the two-session OCC procedure below and receive the documented
      revision-conflict response/UI rather than overwriting data.
- [ ] Refresh/open the winning revision and delete the project through the UI/API.
- [ ] Confirm it no longer appears. Leave no smoke projects or schema data.

## OCC test with two sessions

1. Log the same smoke user into Browser Profile A and Browser Profile B. These
   must be independent cookie jars/sessions.
2. In A, create and save one project. In both profiles, open the same project and
   record the same starting server revision `N`.
3. In A, make change A and save. Confirm success at revision `N+1`.
4. Without refreshing B, make a distinct change B and save using B's stale
   expected revision `N`.
5. Confirm B receives HTTP 409 / `PROJECT_REVISION_CONFLICT` and does not report
   a successful save. Confirm A's data remains authoritative after reopening.
6. Refresh/reopen in B, confirm revision `N+1`, then delete the project normally.

Do not manipulate revision columns or project rows directly in PostgreSQL.

## Browser security and CORS

- [ ] Browser location is exactly `https://staging.<domain>` and API requests go
      to `https://api.staging.<domain>`; their registrable domain and HTTPS
      scheme match, so they are schemefully same-site.
- [ ] Login/register response sets `schemawise_session` with `Secure`,
      `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain` attribute (host-only).
- [ ] Credentialed requests send the cookie only to the API host.
- [ ] Allowed-origin responses use
      `Access-Control-Allow-Origin: https://staging.<domain>` exactly and
      `Access-Control-Allow-Credentials: true`; never `*`.
- [ ] A request from a provider origin or another controlled origin receives no
      usable credentialed CORS response.
- [ ] An authenticated POST/PUT/DELETE with the CSRF header omitted, modified,
      or from a mismatched Origin is rejected and causes no state change.
- [ ] Cookies, passwords, CSRF tokens, and DB URLs are absent from response error
      envelopes, page source, JS storage, console output, and URLs.

## Logs and error sanitation

Inspect Render logs during every flow above:

- [ ] Request-start/completion records contain request IDs, method/path, status,
      duration, and enough context to correlate an error.
- [ ] No password, request body, `Cookie`/`Set-Cookie`, Authorization value,
      `X-CSRF-Token`, session token, `DATABASE_URL`,
      `DATABASE_MIGRATION_URL`, or query credential appears.
- [ ] Expected 4xx responses are safe; induce one harmless validation failure and
      confirm any 500/public error is sanitized and internal logs expose no
      query, connection string, or secret.
- [ ] Startup, migration, `/ready`, graceful shutdown, restart count, and failed
      deploy events are understandable from provider logs.

## Rate limit and client-IP validation

Do not perform load, attack, or credential-stuffing tests.

- [ ] Confirm the deployed service has `CLIENT_IP_MODE=render` and does not set
      `TRUST_PROXY`.
- [ ] From network A, send one controlled auth failure and record only approved
      diagnostic evidence of the normalized effective client identity.
- [ ] Repeat from an independent network B (for example mobile data). The two
      effective identities and rate-limit buckets must differ.
- [ ] From network A, send one otherwise identical request with a deliberately
      forged `X-Forwarded-For`. Its effective identity and bucket must remain
      unchanged. Do not attempt to forge `CF-Connecting-IP` as proof at the
      application port: the required property is Render edge overwrite, and the
      application port is not public.
- [ ] With a dedicated test account/window and the smallest harmless sequence,
      reach one configured auth limit; confirm HTTP 429 and a positive integer
      `Retry-After`, then stop. Do not exhaust unrelated/shared limits.
- [ ] Confirm missing/malformed provider identity fails closed if it can be
      exercised through an approved diagnostic path. Any observation that
      `CF-Connecting-IP` is caller-controlled, absent, or not a single valid IP
      blocks staging and triggers provider/topology review.

## Completion and cleanup

- [ ] All smoke projects are deleted; the dedicated smoke account may remain
      because no delete-user API exists.
- [ ] Render `onrender.com` access returns 404 after custom-domain verification;
      generated Vercel URLs are not in CORS and cannot complete auth flows.
- [ ] Neon `pgmigrations` still contains exactly migrations 001-004 and no seed
      migration/data was added.
- [ ] Record failures and owners. Staging is not accepted while any real
      client-IP, cookie/CORS/CSRF, or logging check fails.
