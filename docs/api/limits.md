# Límites operativos del API v1

Los algoritmos aceptan conjuntos matemáticos finitos, pero varias operaciones
enumeran subconjuntos y tienen coste exponencial. Los siguientes son límites de
producto para requests HTTP síncronos, no límites matemáticos del Normalization
Engine.

## Límites iniciales

| Límite | Valor v1 | Motivo |
| --- | ---: | --- |
| `maxAttributes` | 6 | Projection ya supera la ventana de benchmark con 8 atributos; 6 mantiene margen para BCNF y preservación. |
| `maxFunctionalDependencies` | 12 | Permite familias densas de hasta 6 atributos y acota cierres y minimal cover. |
| `maxDecompositionRelations` | 12 | Acota proyecciones repetidas por preservación y el tamaño de evidencia. |
| `maxPayloadBytes` | 65.536 (64 KiB) | Muy superior al payload posible bajo los límites semánticos y evita cuerpos absurdos. |
| `maxAttributeIdLength` | 64 caracteres | Identidad legible y estable, sin transportar claves desmesuradas. |
| `maxAttributeNameLength` | 120 caracteres | Suficiente para display names de UI. |
| `maxRelationNameLength` | 120 caracteres | Suficiente para nombres lógicos, sin imponer reglas SQL. |

IDs y nombres se miden en caracteres Unicode después de validar que no haya
espacios en los extremos. Las restricciones de longitud y payload son de
transporte/producto; no forman parte de la teoría de normalización.

Seis atributos es deliberadamente conservador. Candidate Key Discovery explora
combinaciones de atributos opcionales; 2NF recorre subconjuntos de claves; 3NF y
BCNF analizan subconjuntos de la relación. FD Projection también enumera los
subconjuntos del esquema objetivo y calcula cierres antes de minimizar. BCNF
Decomposition repite proyección/análisis en nodos de una descomposición
recursiva. 3NF Synthesis calcula minimal cover y candidate keys. Por ello, elevar
el límite por observar que `2^12` es pequeño ignoraría el factor de FDs, cierres,
minimalización y repetición entre nodos.

Todos los endpoints aplican `maxAttributes` y `maxFunctionalDependencies` antes
de invocar el engine. Dependency Preservation aplica además
`maxDecompositionRelations`. Las dos relaciones producidas por cada paso BCNF y
las hojas se mantienen naturalmente acotadas por el número de atributos, pero
la implementación deberá aplicar también un límite defensivo equivalente antes
de serializar un resultado anómalo.

Superar cardinalidad o longitud devuelve `422 Unprocessable Entity` con
`ANALYSIS_LIMIT_EXCEEDED`. Superar bytes devuelve `413 Payload Too Large` con el
mismo código. `details` debería identificar un único `limit`, su `maximum` y el
`actual` cuando se conozca con seguridad.

## Presupuesto temporal síncrono

El presupuesto se mide dentro del servicio desde que el request fue validado y
antes de mapear la respuesta:

| Operación | Timeout máximo v1 |
| --- | ---: |
| `closure` | 1 segundo |
| `analysis` | 3 segundos |
| `synthesis/3nf` | 3 segundos |
| `decomposition/bcnf` | 5 segundos |
| `analysis/dependency-preservation` | 5 segundos |

Closure es iterativo y barato. El análisis agregado reutilizará resultados
intermedios en Application Layer cuando sea posible, pero incluye búsquedas
exponenciales. BCNF y preservación reciben más tiempo porque ejecutan múltiples
proyecciones. Estos tiempos son presupuestos del producto, a validar con
benchmarks antes de implementar el transporte; no prometen cancelación interna
del engine en v1.

Los presupuestos anteriores son objetivos de producto y observabilidad. En una
implementación directa, síncrona y CPU-bound, un timer del mismo event loop no
puede interrumpir el algoritmo. El mapping HTTP de `OPERATION_TIMEOUT` queda
pendiente de la decisión de runtime; no se congela `503` en v1.

## Revisión

Antes de aumentar límites se deben medir casos adversariales, no sólo casos
promedio: múltiples claves candidatas, determinantes vacíos, FDs redundantes,
proyecciones grandes y árboles BCNF profundos. Cambiar límites operativos dentro
de los máximos publicados puede ser configuración; elevar los máximos
contractuales requiere documentación y pruebas de carga.

## Opciones de runtime futuras

Se evaluaron cuatro estrategias: (A) límites estrictos y ejecución directa en el
proceso, (B) `worker_threads` terminables, (C) proceso hijo/job aislado y (D)
jobs asíncronos futuros. Para v1 se elige A: el dominio aceptado es pequeño y
no añade complejidad operativa. B o C serán necesarias si se requiere
cancelación real de CPU o límites más altos; D corresponde a cargas que no deben
bloquear una request interactiva. `Promise.race`, `setTimeout` y
`AbortController` no preemptan por sí solos este código síncrono.
