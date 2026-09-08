# API Contract v1

Estado: aprobado para congelar tras la revisión empírica del engine.

## Alcance y base URL

El API v1 de SchemaWise es un API computacional, sin estado y basado en el
Normalization Engine v1. Todos los endpoints viven bajo `/api/v1`:

| Método y ruta | Responsabilidad |
| --- | --- |
| `POST /api/v1/analysis` | Análisis agregado: claves, atributos primos, minimal cover, 2NF, 3NF y BCNF. |
| `POST /api/v1/synthesis/3nf` | Síntesis de una descomposición en 3NF. |
| `POST /api/v1/decomposition/bcnf` | Descomposición determinística en BCNF. |
| `POST /api/v1/analysis/dependency-preservation` | Preservación de FDs para cualquier descomposición completa. |
| `POST /api/v1/closure` | Cierre de un conjunto de atributos. |

Los contratos de tipos están centralizados en `dtos.md`, los errores en
`errors.md` y los límites en `limits.md`.

No forman parte de este contrato HTTP: FD Projection, un endpoint aislado de
Minimal Cover, persistencia de proyectos, autenticación, SQL ni explicaciones
generadas. Projection permanece como operación interna de Application/Engine y
podrá evaluarse para un futuro modo educativo. Minimal Cover ya se entrega en
`/analysis` y en síntesis; otro endpoint fragmentaría el API sin habilitar hoy
un flujo de usuario distinto.

## Versionado

Se usa versionado mayor explícito en la URL. `/api/v1` es visible en clientes,
logs, caches y herramientas; permite desplegar en paralelo una futura versión
incompatible y mantiene simple la negociación para una primera API pública.
Cambios compatibles pueden añadirse dentro de v1; cambios incompatibles
requieren otra versión mayor. No se define v2 ni versionado alternativo por
headers en esta iteración.

## Semántica común

Todas las operaciones son cálculos puros. Usan `POST` porque reciben documentos
estructurados potencialmente extensos y representan comandos de cálculo, no
recursos direccionables. Aun así son idempotentes: la misma entrada válida,
misma versión del engine y mismos límites produce la misma respuesta. No se
necesitan idempotency keys.

Una respuesta exitosa usa `200 OK` y `application/json`. El transporte no
serializa instancias del engine. Los límites y errores pueden impedir que una
entrada obtenga resultado aunque sea matemáticamente válida.

Authentication: out of scope for computational API v1. Guardar proyectos será
responsabilidad de un futuro Project Persistence API, separado del
Computational API. Ningún endpoint v1 guarda datos.

## `POST /api/v1/analysis`

Acepta `SchemaAnalysisRequest` y devuelve `AnalysisResponseDto`. Agrupa las
consultas centrales para que la UI no coordine múltiples requests. No ejecuta
síntesis 3NF, descomposición BCNF ni preservación automáticamente.

### Ejemplo completo: R(A,B,C), A -> B, B -> C

Request:

```http
POST /api/v1/analysis
Content-Type: application/json
```

```json
{
  "relation": {
    "name": "R",
    "attributes": [
      { "id": "a", "name": "A" },
      { "id": "b", "name": "B" },
      { "id": "c", "name": "C" }
    ]
  },
  "functionalDependencies": [
    { "left": ["a"], "right": ["b"] },
    { "left": ["b"], "right": ["c"] }
  ]
}
```

Response `200 OK`:

```json
{
  "relation": {
    "name": "R",
    "attributes": [
      { "id": "a", "name": "A" },
      { "id": "b", "name": "B" },
      { "id": "c", "name": "C" }
    ]
  },
  "candidateKeys": [["a"]],
  "primeAttributes": ["a"],
  "minimalCover": [
    { "left": ["a"], "right": ["b"] },
    { "left": ["b"], "right": ["c"] }
  ],
  "normalForms": {
    "second": {
      "satisfied": true,
      "violations": []
    },
    "third": {
      "satisfied": false,
      "violations": [
        { "determinant": ["b"], "dependent": "c" }
      ]
    },
    "bcnf": {
      "satisfied": false,
      "violations": [
        { "determinant": ["b"], "dependent": "c" }
      ]
    }
  }
}
```

`a+ = {a,b,c}`, por lo que `{a}` es la única clave candidata y `a` el único
atributo primo. Al ser una clave unitaria no existe dependencia parcial propia,
así que satisface 2NF. `b -> c` tiene determinante no superclave y dependiente no
primo: viola 3NF y BCNF. El minimal cover ya es el conjunto original.

## `POST /api/v1/synthesis/3nf`

Acepta `SchemaAnalysisRequest` y devuelve relaciones sintetizadas, el minimal
cover usado, y la clave candidata agregada si fue necesaria.

Request:

```json
{
  "relation": {
    "name": "R",
    "attributes": [
      { "id": "a", "name": "A" },
      { "id": "b", "name": "B" },
      { "id": "c", "name": "C" }
    ]
  },
  "functionalDependencies": [
    { "left": ["a"], "right": ["b"] }
  ]
}
```

Response `200 OK`:

```json
{
  "relations": [
    { "attributes": ["a", "b"], "source": "minimal-cover" },
    { "attributes": ["a", "c"], "source": "candidate-key" }
  ],
  "minimalCover": [
    { "left": ["a"], "right": ["b"] }
  ],
  "addedCandidateKey": ["a", "c"]
}
```

## `POST /api/v1/decomposition/bcnf`

Acepta `SchemaAnalysisRequest`. Devuelve las hojas BCNF y evidencia de cada
descomposición binaria, sin afirmar preservación de dependencias.

Request: el mismo esquema `R(A,B,C)` con `A -> B` y `B -> C` del ejemplo de
análisis.

Response `200 OK`:

```json
{
  "relations": [
    { "attributes": ["a", "b"] },
    { "attributes": ["b", "c"] }
  ],
  "steps": [
    {
      "source": ["a", "b", "c"],
      "violation": {
        "determinant": ["b"],
        "dependent": "c"
      },
      "result": [["b", "c"], ["a", "b"]]
    }
  ]
}
```

## `POST /api/v1/analysis/dependency-preservation`

Acepta el request base más `decomposition: AttributeSetDto[]`. La
descomposición puede venir de síntesis, BCNF o una futura entrada manual. Debe
usar sólo atributos de la relación y cubrirla por completo. Devuelve
`preserved`, `preservedDependencies` y `lostDependencies`; la evidencia se
expresa como FDs de singleton RHS del minimal cover original.

## `POST /api/v1/closure`

Acepta el request base más `attributes: AttributeSetDto` y devuelve
`{ "closure": AttributeSetDto }`. Se incluye públicamente en v1 porque habilita
un caso educativo y paso a paso concreto sin forzar a ejecutar el análisis
agregado. Sigue sujeto al scope de la relación.

## Ejecución y límites

v1 usa límites estrictos de entrada (`maxAttributes=6`,
`maxFunctionalDependencies=12`, `maxDecompositionRelations=12`) y ejecución
síncrona directa. Node no puede preemptar un cálculo CPU-bound desde un timer
del mismo event loop. `OPERATION_TIMEOUT` conserva su código público, pero su
status HTTP queda como decisión de runtime pendiente; no se congela `503`.

## Evolución a OpenAPI

Este contrato debe revisarse antes de traducirse a OpenAPI 3.1. La futura
especificación referenciará esquemas compartidos equivalentes a `dtos.md` y no
mantendrá copias divergentes de los tipos.
