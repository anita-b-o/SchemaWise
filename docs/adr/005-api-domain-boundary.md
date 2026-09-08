# ADR 005: Separar DTOs HTTP del modelo de dominio

## Status

Accepted

## Context

El Normalization Engine expone clases inmutables con invariantes y algoritmos
matemáticos. Serializar esas clases o entregar JSON a sus constructores
acoplaría frontend, transporte y dominio; también expondría mensajes internos
como contrato accidental.

## Decision

Los DTOs pertenecen a la frontera Application/API. Un mapper valida IDs y scope,
construye objetos de dominio desde una tabla canónica de atributos, invoca el
engine y convierte resultados nuevamente a DTOs. `Attribute` se representa como
objeto, `AttributeSet` como array de IDs y `FunctionalDependency` como dos arrays
de IDs. Ninguna clase o excepción del engine se serializa directamente.

La respuesta conserva `relation.attributes` con IDs y names para la UI, mientras
que toda evidencia matemática referencia únicamente IDs.

## Consequences

- El engine permanece independiente de HTTP, JSON y status codes.
- Frontend y contrato no dependen de constructores ni estructura interna.
- La Application Layer asume validación, resolución de referencias, composición
  y traducción de errores.
- Existe mapeo explícito adicional, pero puede probarse aisladamente y permite
  evolucionar transporte y dominio con menor acoplamiento.
