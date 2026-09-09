# SchemaWise API OpenAPI

`schemawise-api-v1.yaml` is the OpenAPI 3.1 representation of the approved
HTTP contract in `docs/api` plus the separate Auth HTTP v1 surface. Auth is
tagged independently from the five frozen computational endpoints. Its cookie
transport, session-bound `csrfToken`, conditional logout header, security error
responses, and auth rate-limit response are part of the public-ready contract.
