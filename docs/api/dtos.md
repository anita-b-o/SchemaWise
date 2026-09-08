# DTOs del API v1

Este documento es la definición canónica de las representaciones JSON del API
computacional v1. Los ejemplos de endpoints de `api-v1.md` usan estos tipos por
referencia. Los DTOs pertenecen a la frontera Application/API: no son clases del
Normalization Engine y nunca se entregan directamente al motor.

## Convenciones

- Todo campo documentado es obligatorio salvo que se indique `null` u opcional.
- No se aceptan propiedades desconocidas en v1.
- Los identificadores son sensibles a mayúsculas y minúsculas.
- Los strings deben ser no vacíos y no pueden tener espacios en los extremos;
  v1 los rechaza en vez de normalizar silenciosamente su identidad o display.
- La capa de aplicación valida primero el documento completo y después crea una
  única tabla `id -> Attribute` para mapear referencias al dominio.
- Todos los resultados matemáticos usan IDs. Los nombres visibles se resuelven
  desde `relation.attributes`.
- `1NF` es una precondición externa; estos DTOs describen análisis basados en FDs
  y no intentan inferir atomicidad.

## Tipos base

### AttributeDto

```json
{
  "id": "customer_id",
  "name": "Customer ID"
}
```

`id` es la identidad estable del atributo dentro de una operación. `name` es su
nombre visible. Los IDs deben ser únicos en `relation.attributes`. Repetir un ID
con otro nombre es una colisión de identidad; repetirlo con el mismo nombre sigue
siendo inválido porque la lista exige IDs únicos.

### RelationDto

```json
{
  "name": "VENTA",
  "attributes": [
    { "id": "sale_id", "name": "Sale ID" },
    { "id": "customer_id", "name": "Customer ID" }
  ]
}
```

La relación debe tener nombre y al menos un atributo. El contrato no incluye
tipos SQL, PK, FK, nulabilidad, defaults ni índices.

### AttributeSetDto

```json
["sale_id", "product_id"]
```

Un `AttributeSet` se serializa como `string[]`, sin duplicados, y cada ID debe
existir en la relación del request. No se expone como objeto ni se serializa la
estructura interna de la clase de dominio: un array expresa el valor matemático,
es simple para JSON y evita acoplar el API a la implementación del engine.

El array vacío representa el conjunto vacío. El orden de salida es el orden
canónico provisto por el engine. El orden de entrada no cambia el resultado.

### FunctionalDependencyDto

```json
{
  "left": ["sale_id", "product_id"],
  "right": ["quantity"]
}
```

Ambos lados son `AttributeSetDto`. Esto representa `A -> B`, `AB -> C`,
`A -> BC`, `empty -> A` y `A -> empty`, por ejemplo:

```json
{ "left": [], "right": ["a"] }
```

```json
{ "left": ["a"], "right": [] }
```

Un RHS vacío es válido estructuralmente y matemáticamente trivial. Algoritmos
como Minimal Cover pueden eliminarlo del resultado. Las FDs sólo referencian
IDs: no repiten objetos `AttributeDto`.

### SchemaAnalysisRequest

```json
{
  "relation": {
    "name": "R",
    "attributes": [
      { "id": "a", "name": "A" },
      { "id": "b", "name": "B" }
    ]
  },
  "functionalDependencies": [
    { "left": ["a"], "right": ["b"] }
  ]
}
```

Es el request base reusable de análisis y transformaciones.

## AnalysisResponseDto

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
    "second": { "satisfied": true, "violations": [] },
    "third": {
      "satisfied": false,
      "violations": [{ "determinant": ["b"], "dependent": "c" }]
    },
    "bcnf": {
      "satisfied": false,
      "violations": [{ "determinant": ["b"], "dependent": "c" }]
    }
  }
}
```

`relation` es la representación validada del input; sus atributos se serializan
desde el `AttributeSet` de dominio en orden canónico y conservan los nombres
necesarios para la UI. `candidateKeys`, `primeAttributes` y `minimalCover` se
obtienen del engine. `normalForms` agrupa análisis independientes del engine; la
capa de aplicación compone la respuesta, pero no deriva nuevas conclusiones.

### SecondNormalFormViolationDto

```json
{
  "candidateKey": ["a", "b"],
  "determinant": ["a"],
  "dependent": "c"
}
```

### ThirdNormalFormViolationDto y BcnfViolationDto

```json
{
  "determinant": ["b"],
  "dependent": "c"
}
```

El tipo de la colección ya establece por qué es una violación. No se agregan
flags redundantes ni explicaciones en lenguaje natural.

## 3NF synthesis

`ThirdNormalFormSynthesisRequestDto` es `SchemaAnalysisRequest`.

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

`source` sólo puede ser `minimal-cover` o `candidate-key`.
`addedCandidateKey` es un `AttributeSetDto` cuando el algoritmo debió agregar
una relación que contenga una clave candidata, y `null` en otro caso. No se
inventan nombres de relaciones ni conceptos SQL.

## BCNF decomposition

`BcnfDecompositionRequestDto` es `SchemaAnalysisRequest`.

```json
{
  "relations": [
    { "attributes": ["a", "b"] },
    { "attributes": ["b", "c"] }
  ],
  "steps": [
    {
      "source": ["a", "b", "c"],
      "violation": { "determinant": ["b"], "dependent": "c" },
      "result": [["b", "c"], ["a", "b"]]
    }
  ]
}
```

`result` es una tupla JSON de exactamente dos `AttributeSetDto`. Las relaciones
finales y los pasos provienen directamente de las estructuras del engine.

## Dependency preservation

El request extiende el request base con una descomposición independiente de su
origen:

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
    { "left": ["a", "b"], "right": ["c"] },
    { "left": ["c"], "right": ["b"] }
  ],
  "decomposition": [["a", "c"], ["b", "c"]]
}
```

```json
{
  "preserved": false,
  "preservedDependencies": [
    { "left": ["c"], "right": ["b"] }
  ],
  "lostDependencies": [
    { "left": ["a", "b"], "right": ["c"] }
  ]
}
```

Las listas de evidencia clasifican el minimal cover de las FDs originales, tal
como lo hace el engine; no necesariamente conservan la forma textual del input.

## Attribute closure

El request extiende el request base con `attributes: AttributeSetDto`:

```json
{
  "relation": {
    "name": "R",
    "attributes": [
      { "id": "a", "name": "A" },
      { "id": "b", "name": "B" }
    ]
  },
  "functionalDependencies": [
    { "left": ["a"], "right": ["b"] }
  ],
  "attributes": ["a"]
}
```

La respuesta es:

```json
{ "closure": ["a", "b"] }
```

## Orden determinístico

La capa HTTP preserva el orden canónico del engine en todos los arrays de
salida: IDs dentro de conjuntos, claves candidatas, minimal cover, violaciones,
relaciones sintetizadas, hojas BCNF, pasos y listas de preservación. Los mappers
no reordenan según el request, el nombre visible, el locale o preferencias de
UI. La garantía permite comparar respuestas equivalentes y construir snapshots
estables, sin afirmar que el orden tenga significado matemático.
