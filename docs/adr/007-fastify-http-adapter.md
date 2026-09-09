# ADR 007: Fastify HTTP adapter

## Status

Accepted

## Context

SchemaWise necesita exponer el API Contract v1 sin mezclar transporte con la
normalización matemática. El runtime v1 es síncrono y está acotado por límites
de input, sin preemption CPU real.

## Decision

Usar Fastify como adapter HTTP. `createServer()` será una factory testeable que
no abre puertos; `startServer()` será el entrypoint separado. Fastify aplicará
JSON y 64 KiB de body limit. Un error handler único producirá el error envelope
estable y los handlers delegarán exclusivamente en Application Layer.

## Consequences

El transporte queda pequeño, inyectable y verificable sin red. Se obtiene
validación de tamaño/media type del framework y mapeo HTTP consistente. No hay
cancelación de cálculos CPU-bound ni `OPERATION_TIMEOUT` artificial; si se
necesita preemption real, habrá que diseñar un runtime aislado antes de elevar
los límites o añadir trabajos asíncronos.
