# SchemaWise API OpenAPI

`schemawise-api-v1.yaml` is the OpenAPI 3.1 representation of the approved
HTTP contract in `docs/api` plus the separate Auth HTTP v1 surface. Auth is
tagged independently from the five frozen computational endpoints. Its cookie
transport is documented without a `csrfToken`: CSRF, credentialed CORS and
rate limiting remain an explicit public-exposure gate.
