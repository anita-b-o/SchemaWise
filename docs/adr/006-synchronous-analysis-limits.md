# ADR 006: Límites conservadores para análisis síncrono

## Status

Accepted

## Context

Candidate keys, análisis de formas normales, FD Projection y BCNF Decomposition
pueden enumerar subconjuntos. El coste combina crecimiento exponencial con
cierres repetidos, cantidad de FDs y, en BCNF/preservación, múltiples
proyecciones. Un API síncrono no puede aceptar cardinalidad arbitraria.

## Decision

El benchmark local documentado en `docs/engineering/normalization-engine-benchmarks.md`
mostró un salto de coste en Projection a partir de 8 atributos y casos densos.
El API v1 limita cada esquema a 6 atributos y 12 FDs, y las descomposiciones de
entrada a 12 subrelaciones. El body máximo es 64 KiB. Closure tiene un presupuesto
de 1 segundo; análisis y síntesis, 3 segundos; BCNF y preservación, 5 segundos.
Estos son presupuestos de producto, no mecanismos de cancelación.

Superar cardinalidad/longitud produce `422`; superar bytes, `413`; `OPERATION_TIMEOUT`
queda con status pendiente de la decisión de runtime. Son límites de producto, no afirmaciones sobre el
dominio matemático ni cambios al engine.

## Consequences

- El servicio protege latencia y recursos con reglas visibles para clientes.
- Algunos inputs válidos para el engine no serán aceptados por el API síncrono.
- Los números se derivan de órdenes de magnitud observadas localmente.
- La ejecución síncrona directa es aceptable con estos límites; un timer del mismo
  event loop no puede preemptar un cálculo CPU-bound.
- Casos mayores podrán migrar a jobs asíncronos en el futuro, sin introducir
  colas ni estados de job en v1.
