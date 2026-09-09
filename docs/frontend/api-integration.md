# Frontend API integration

## Boundary

All transport crosses `src/api/schemawise-api.ts`. Components receive typed
functions through direct imports or a thin context only if testing later needs
injection; they never call `fetch` themselves. DTOs in
`src/api/schemawise-contracts.ts` mirror the frozen OpenAPI v1 contract and do
not import engine domain classes.

The initial hand-written types are small enough to review. OpenAPI generation
can be evaluated later, but adding a generator is not required to build the MVP.
OpenAPI remains canonical whenever types disagree.

## Client surface

```ts
export interface SchemaWiseApi {
  analyze(input: SchemaInputDto, signal?: AbortSignal):
    Promise<AnalysisResponseDto>;
  calculateClosure(input: ClosureRequestDto, signal?: AbortSignal):
    Promise<ClosureResponseDto>;
  synthesizeThirdNormalForm(input: SchemaInputDto, signal?: AbortSignal):
    Promise<ThirdNormalFormSynthesisResponseDto>;
  decomposeBcnf(input: SchemaInputDto, signal?: AbortSignal):
    Promise<BcnfDecompositionResponseDto>;
  analyzeDependencyPreservation(
    input: DependencyPreservationRequestDto,
    signal?: AbortSignal,
  ): Promise<DependencyPreservationResponseDto>;
}
```

| Method | Endpoint |
| --- | --- |
| `analyze` | `POST /api/v1/analysis` |
| `calculateClosure` | `POST /api/v1/closure` |
| `synthesizeThirdNormalForm` | `POST /api/v1/synthesis/3nf` |
| `decomposeBcnf` | `POST /api/v1/decomposition/bcnf` |
| `analyzeDependencyPreservation` | `POST /api/v1/analysis/dependency-preservation` |

The client owns base URL resolution, JSON headers, serialization, response
parsing and error normalization. A same-origin `/api` default is preferred for
deployment; Vite development may proxy `/api` to the local Fastify server. An
environment override can be introduced only when deployment topology requires
it.

## Draft mapping

The mapper trims only for validation comparison; requests are built after
validation and contain the intended exact display values. Attribute IDs are
opaque stable IDs. All FD sides and tool selections reference them.

```text
SchemaDraft
  -> validate names, counts, duplicates and references
  -> SchemaInputDto
  -> schemawise-api client
  -> API DTO
  -> id/name resolver + presentation view model
```

The response `relation` is the source for resolving analysis IDs. Synthesis and
BCNF responses do not include relation metadata, so their renderers use the
immutable analyzed request snapshot that initiated the operation. A late
response is accepted only if its request ID remains current.

Dependency preservation is constructed from that same snapshot plus BCNF leaf
relations:

```ts
{
  ...analyzedSchema,
  decomposition: bcnfResult.relations.map(({ attributes }) => attributes),
}
```

## Error model

The client distinguishes:

```ts
type ApiError = {
  kind: "api";
  status: number;
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

type UnexpectedApiError = {
  kind: "unexpected";
  cause: "network" | "invalid-response" | "aborted" | "unknown";
};
```

Known error codes map to stable frontend copy/locations. The server `message` is
shown as supporting diagnostics but is never parsed. Examples:

- `INVALID_RELATION` -> relation section;
- `INVALID_ATTRIBUTE` or `ATTRIBUTE_IDENTITY_COLLISION` -> attribute section;
- `INVALID_FUNCTIONAL_DEPENDENCY` or `UNKNOWN_ATTRIBUTE_REFERENCE` -> FD/tool
  selection section when details identify it, otherwise editor-level;
- `ANALYSIS_LIMIT_EXCEEDED` -> relevant counter/field using structured details;
- `INCOMPLETE_DECOMPOSITION` or `SCHEMA_SCOPE_VIOLATION` -> preservation result;
- `INTERNAL_ERROR`, malformed success bodies and network failures -> operation
  banner with retry.

`AbortError` caused by a superseded request is silent. HTTP success with an
unreadable body becomes `invalid-response`; it does not pass unchecked data to
the view. Runtime schema validation is desirable at the transport boundary, but
library choice is deferred until implementation; it must not duplicate domain
validation in components.

## Request policy

- Every calculation is explicit; no request fires on each keystroke.
- Analyze does not fan out into synthesis, BCNF or closure.
- No cache library, retry loop or optimistic result is needed.
- User-initiated retry is offered for transient/unexpected errors.
- Previous successful content may remain visible with an error banner and clear
  stale/current labeling.
- Payload and product limits are surfaced before request, while the API remains
  authoritative for all validation and mathematical results.

## Contract compatibility review

The current API supplies all data required by the proposed MVP. In particular:

- analysis includes relation names needed to resolve output IDs;
- 2NF evidence identifies candidate key, partial determinant and dependent;
- 3NF/BCNF evidence identifies determinant and dependent, and collection context
  supplies the violated rule;
- synthesis exposes relation source and `addedCandidateKey`;
- BCNF exposes leaves and ordered binary steps;
- preservation accepts those leaf attribute sets directly.

No backend or OpenAPI change is required. The frontend must retain its analyzed
request snapshot for rendering transformation responses; this is a frontend
state requirement, not a contract incompatibility.

