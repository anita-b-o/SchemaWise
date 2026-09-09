# Application/API Layer

La frontera computacional de SchemaWise sigue esta dirección:

```text
Frontend
   |
   v
HTTP API (/api/v1, JSON DTOs)
   |
   v
Application mapper + use case
   |
   v
Domain objects
   |
   v
Normalization Engine v1
   |
   v
Application mapper
   |
   v
HTTP response DTO
```

## Responsabilidades

El adaptador HTTP parsea JSON, aplica tamaño/media type y entrega DTOs a la capa
de aplicación. No construye reglas matemáticas ni llama algoritmos del engine de
forma descoordinada.

La Application Layer:

1. valida forma, referencias, unicidad, scope y límites del request;
2. crea una tabla canónica `attribute id -> Attribute` desde la relación;
3. resuelve todos los arrays de IDs contra esa tabla;
4. construye `AttributeSet`, `Relation` y `FunctionalDependency`;
5. orquesta una o más operaciones públicas del engine;
6. convierte los resultados inmutables a DTOs JSON por ID;
7. traduce errores esperables a errores públicos estables.

Ningún DTO entra al engine. Ninguna clase, colección privada o excepción del
engine se serializa directamente. El engine no conoce JSON, rutas, códigos HTTP,
timeouts ni envelopes de error. El frontend sólo conoce DTOs y nunca importa
`Attribute`, `Relation`, `AttributeSet` o `FunctionalDependency`.

Los mappers preservan el orden de salida del engine. Sólo reconstruyen
representaciones: `Attribute -> AttributeDto`, `AttributeSet -> string[]` y
`FunctionalDependency -> { left, right }`. El objeto `relation` devuelto se
reconstruye desde la relación de dominio, incluidos sus atributos en orden
canónico, para que la UI resuelva names; ésta es una decisión de Application
Layer, no un resultado matemático nuevo del engine.

## Use cases v1

### `AnalyzeSchema`

Construye un único modelo de dominio y coordina Candidate Key Discovery, Prime
Attributes, Minimal Cover y análisis 2NF/3NF/BCNF. Puede reutilizar claves ya
calculadas internamente cuando una futura interfaz del engine lo permita, pero
v1 no modifica el engine para optimizar esta composición. Produce la respuesta
agregada y no ejecuta transformaciones.

### `CalculateClosure`

Resuelve el conjunto solicitado, valida que esté en scope e invoca Attribute
Closure.

### `SynthesizeThirdNormalForm`

Invoca 3NF Synthesis y mapea relaciones, origen, minimal cover y eventual clave
agregada.

### `DecomposeBoyceCodd`

Invoca BCNF Decomposition y mapea hojas y pasos binarios. No declara
preservación de dependencias.

### `AnalyzeDependencyPreservation`

Valida una descomposición completa independiente de su procedencia, la convierte
a `AttributeSet[]` e invoca Dependency Preservation Analysis.

### Operaciones internas

`ProjectFunctionalDependencies` permanece disponible para composición interna
del engine/Application Layer, no como endpoint v1. `FindMinimalCover` se usa en
análisis y síntesis, pero no tiene endpoint propio en v1.

## Fronteras futuras

El API actual no autentica ni persiste. Un futuro Project Persistence API podrá
guardar inputs o resultados, pero no cambiará la semántica del Computational
API ni convertirá `POST /analysis` en una operación de guardado. El contrato
OpenAPI 3.1 vive en `apps/api/openapi/schemawise-api-v1.yaml`; todavía no hay
framework HTTP, controllers, observabilidad ni cancelación. El futuro HTTP
adapter deberá aplicar media type y los 64 KiB de payload antes de invocar esta
capa, y decidir el status de `OPERATION_TIMEOUT` según el mecanismo de
ejecución elegido.
