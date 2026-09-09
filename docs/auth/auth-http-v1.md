# Auth HTTP v1

Status: **functional, not public-ready**.

Fastify exposes `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET
/api/v1/auth/me`, and `POST /api/v1/auth/logout`. Register and login accept only
`{ email, password }` and return `{ user: { id, email } }`; the raw session token
is never JSON. The omission of the final-design `csrfToken` is deliberate and
temporary because CSRF runtime is scheduled for the next security tranche.

The `schemawise_session` cookie is host-only (`Domain` omitted), `HttpOnly`,
`Path=/`, `SameSite=Lax`, with `Max-Age=2592000`, an absolute `Expires` copied
from the session, and `Secure` controlled explicitly by the required
`AUTH_COOKIE_SECURE`. Local HTTP uses `false`; production must use `true`. The token is 32 random
bytes encoded base64url. Only its SHA-256 digest is stored in PostgreSQL.

`resolveAuthenticatedUser(request)` is the reusable HTTP/application boundary.
It returns `AuthContext { userId, user }` and never exposes a raw token. Missing,
malformed, unknown, expired and revoked sessions map to `401 UNAUTHENTICATED`.
When a cookie was presented but cannot authenticate, `/me` clears it using the
same path and security attributes to prevent repeated stale requests. Missing
cookies are not needlessly cleared.

Logout hashes and revokes the presented token when structurally valid, always
clears the cookie, and returns 204 for missing, invalid, previously revoked or
active sessions. Each login creates a new session and cookie. Older and other
device sessions stay active until individually logged out; logout-all is not
implemented.

No handler logs request bodies, passwords, cookies, PHC strings or tokens.
Unexpected Auth errors are reduced to `AUTH_INTERNAL_ERROR`; credential failure
does not distinguish unknown email from a wrong password.

## Public-exposure gate

The current CORS policy deliberately remains `credentials: false`, so a Vite
browser on another origin cannot perform cookie authentication. CSRF validation
and auth rate limiting are also absent. Logout will receive CSRF enforcement in
the next security tranche. Auth HTTP v1 must not be exposed publicly until CSRF,
credentialed CORS and basic register/login rate limiting are all operational.
Project HTTP routes and frontend auth remain out of scope.
