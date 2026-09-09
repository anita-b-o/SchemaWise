# API v1 real HTTP smoke test

Smoke test manual del flujo HTTP real de SchemaWise: Fastify → Application Layer → Normalization Engine.

## Inicio y detención

Desde la raíz del repositorio:

```bash
npm run typecheck && npm test && npm run build
HOST=127.0.0.1 PORT=3000 npm start --workspace @schemawise/api
```

El servidor escucha en `http://127.0.0.1:3000`. Detener con `Ctrl-C` y comprobar que el puerto dejó de escuchar:

```bash
curl --max-time 1 http://127.0.0.1:3000/api/v1/analysis
```

## Requests principales

Usar `curl` con `Content-Type: application/json` y el esquema `R(A,B,C)` con:

```text
A → B
B → C
```

Resultados esperados:

| Endpoint | Resultado |
| --- | --- |
| `POST /api/v1/analysis` | 200; candidate key `{a}`, prime `{a}`, minimal cover `A→B`, `B→C`; 2NF true, 3NF false, BCNF false |
| `POST /api/v1/closure` con `attributes: ["a"]` | 200; closure `{a,b,c}` |
| `POST /api/v1/synthesis/3nf` | 200; relaciones `{a,b}` y `{b,c}`; `addedCandidateKey: null` |
| `POST /api/v1/decomposition/bcnf` | 200; relaciones `{a,b}` y `{b,c}`; un step por `B→C` |
| `POST /api/v1/analysis/dependency-preservation` con `[["a","b"],["b","c"]]` | 200; `preserved: true`; `lostDependencies: []` |

## Errores y comportamiento HTTP

| Caso | Status / código esperado |
| --- | --- |
| FD `x → a` | 400 / `UNKNOWN_ATTRIBUTE_REFERENCE` |
| 7 atributos | 422 / `ANALYSIS_LIMIT_EXCEEDED` |
| JSON malformado | 400 / `INVALID_REQUEST` |
| Content-Type incorrecto | 415 / envelope `INVALID_REQUEST` |
| Payload mayor a 64 KiB | 413 / `ANALYSIS_LIMIT_EXCEEDED` |
| Ruta desconocida | 404 / envelope `INVALID_REQUEST` |
| `GET /api/v1/analysis` | 404 / envelope `INVALID_REQUEST` (comportamiento actual) |

Las respuestas JSON incluyen `Content-Type: application/json; charset=utf-8`. Las requests inválidas no deben detener el proceso.
