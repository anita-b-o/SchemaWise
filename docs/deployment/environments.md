# Environments

## Local development

Vite and Fastify run on localhost. `AUTH_COOKIE_SECURE=false` is local-only and is never a hosted setting.

## Free demo/staging (ready for provisioning)

Vercel Hobby `*.vercel.app` is the only browser origin. A Vercel Function proxy forwards same-origin `/api/*` traffic to Render Free; a separate Neon Free project holds disposable staging data. Session policy remains host-only `HttpOnly; Secure; SameSite=Lax; Path=/`, no `Domain`, with exact `CORS_ORIGINS=https://<vercel-project>.vercel.app`.

This is suitable for portfolio, smoke and manual testing. It is not production-equivalent or suitable for availability testing, performance/latency expectations, or serious backup/recovery validation: Render sleeps, Neon scales down, and Free allowances/history are limited.

The Render provider URL is public infrastructure. Accepted ADR 016 requires authenticated proxy assertions for every Auth and Project route; anonymous computational and operational endpoints remain public. Origin/Referer and CSRF remain active defense in depth.

## Future production

Production may use paid/custom topology but is not an active staging plan. It requires a separate ADR/security review.
