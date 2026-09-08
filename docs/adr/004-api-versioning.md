# ADR 004: Versionado explícito del API en la URL

## Status

Accepted

## Context

SchemaWise necesita un contrato HTTP estable para clientes web antes de elegir
un framework. La evolución futura puede incluir cambios incompatibles y la
primera versión debe ser fácil de identificar en código cliente, logs y
herramientas.

## Decision

Todos los endpoints computacionales v1 usan el prefijo `/api/v1`. No se ofrece
negociación alternativa por headers y no se define v2. Cambios aditivos y
compatibles pueden incorporarse a v1; cambios incompatibles requieren otra
versión mayor.

## Consequences

- La versión es explícita y fácil de enrutar, observar y probar.
- Una futura versión incompatible puede coexistir con v1.
- Las URLs contienen una decisión de versión y los clientes deberán cambiar de
  ruta para adoptar una versión mayor.
- Evitamos complejidad de negociación de contenido en el primer contrato.
