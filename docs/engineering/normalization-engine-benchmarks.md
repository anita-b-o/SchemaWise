# Normalization Engine benchmark evidence

## Environment and method

Medición local del 8 de septiembre de 2026: Node v22.22.1, Linux x86_64,
kernel 7.0.0-31-generic, engine compilado con TypeScript. Cada caso se ejecuta
en un proceso hijo aislado, con un warm-up y tres muestras; se reportan
min/mediana/max de wall-clock. Un caso que supera 250 ms de ventana se registra
como `>250 ms` y se termina para evitar bloquear el entorno.

Se probaron chains, cycles, determinantes compuestos, múltiples claves
candidatas y conjuntos dense-ish, con 6, 8, 10 y 12 atributos. Las FDs fueron
5–27 según familia. Se midieron closure, candidate keys, 3NF, BCNF, Projection,
3NF synthesis, BCNF decomposition, dependency preservation y una secuencia
agregada equivalente a `/analysis`.

## Resumen (mediana aproximada, ms)

Valores máximos observados entre familias; `>250` excedió la ventana del
harness, no un timeout del API.

| Operación | 6 attrs | 8 attrs | 10 attrs | 12 attrs |
| --- | ---: | ---: | ---: | ---: |
| Closure | 0.11 | 0.11 | 0.07 | 0.09 |
| Candidate keys | 1.07 | 2.47 | 4.61 | 10.84 |
| 3NF analysis | 2.89 | 8.70 | 43.52 | >250 |
| BCNF analysis | 2.04 | 7.79 | 39.05 | >250 |
| FD Projection | 60.94 | >250 | >250 | >250 |
| 3NF synthesis | 1.68 | 1.98 | 5.15 | 10.96 |
| BCNF decomposition | 92.14 | >250 | >250 | >250 |
| Dependency preservation | 1.86 | 2.01 | 2.83 | 4.64 |
| Aggregate `/analysis` | 5.52 | 18.03 | 39.41 | >250 |

Con una ventana mayor, chain/8 Projection superó 5 segundos; chain/6 fue ~42
ms, dense/6 ~61 ms y dense/6 BCNF decomposition ~92 ms.

## Decisión derivada

Se eligen `maxAttributes=6`, `maxFunctionalDependencies=12` y
`maxDecompositionRelations=12`. Son defaults iniciales basados en esta máquina,
no un SLA universal: deben revalidarse con hardware, carga y requests reales.

## Limitaciones

No modela concurrencia, parsing, serialización, GC ni HTTP. El proceso hijo añade
coste de aislamiento, por lo que los valores pequeños son órdenes de magnitud.
Las familias no cubren el peor caso teórico y memoria no se usa como criterio
duro. El harness es una herramienta de ingeniería y no se ejecuta con `npm test`.
