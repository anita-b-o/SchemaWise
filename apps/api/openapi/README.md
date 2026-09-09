# SchemaWise API OpenAPI

`schemawise-api-v1.yaml` is the OpenAPI 3.1 representation of the approved
HTTP contract in `docs/api` plus the Auth and Project HTTP v1 surfaces. Auth and
Projects are tagged independently from the five frozen computational endpoints. Their cookie
transport, session-bound `csrfToken`, conditional logout header, security error
responses, owner-scoped OCC, and auth rate-limit response are part of the
public-ready contract.
