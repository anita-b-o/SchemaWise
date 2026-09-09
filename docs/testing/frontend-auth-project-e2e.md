# Frontend auth and project E2E

## Scope

The browser story uses a real Vite origin, Fastify listener, PostgreSQL-backed
auth/project repositories, real cookies, CORS, CSRF, and the public
computational API. No HTTP mocks are allowed.

## Primary lifecycle

1. Open `/` unauthenticated, load the example, and analyze it.
2. Save opens auth; register and confirm the workspace remains.
3. Save creates revision 1 and shows Saved.
4. Edit an attribute, observe Unsaved changes, Save, and observe Saved at the
   incremented revision.
5. Open the compact list and reload the project without automatic analysis.
6. Logout, confirm the draft remains, and confirm Save asks for sign-in.
7. Login, Save again, delete with confirmation, and confirm content remains as
   an unlinked unsaved draft.

## OCC lifecycle

After the browser loads revision N, update the same owner/project through an
external authenticated API session to N+1. Browser Save with N must receive 409,
show the conflict panel, and leave local input unchanged. Reload saved version
must GET N+1, replace the workspace, and show Saved. The stale mutation is never
retried and no force overwrite is available.

## Automated frontend coverage

Vitest covers initialization `/me`, register/login/logout, memory-only CSRF,
credentialed clients, error normalization, POST/PUT/DELETE request shapes,
incomplete-draft save, dirty state, open/new confirmations, OCC behavior,
delete preservation, 401 preservation, and one-shot CSRF refresh. Existing
analysis and transformation tests establish that computation actions change
calculation resources rather than persisted draft fields.

## Verified run — 2026-09-09

Run against Vite `http://127.0.0.1:5174`, Fastify
`http://127.0.0.1:3000`, and migrated PostgreSQL schema
`schemawise_browser_e2e`. The primary lifecycle passed, including anonymous
analysis, auth prompt, registration, create/update/list/open, logout/login, and
delete with the local draft preserved. PostgreSQL showed revisions 1 → 2 → 3.

For OCC, a second real session updated revision 3 to revision 4 and renamed the
project to `Server OCC version`. The stale browser save displayed the conflict
panel; PostgreSQL remained at revision 4 with the server name. Reload adopted
revision 4 and showed Saved. Final delete left zero project rows while the
browser retained relation `R` and attribute `Account` as Unsaved changes.
Browser console errors: none.
