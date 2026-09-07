# ADR 002: Motor en TypeScript puro

## Status

Accepted

## Context

El motor debe expresar reglas determinísticas de teoría de bases de datos y poder probarse sin depender de una interfaz, un servidor o una base de datos.

## Decision

`@schemawise/normalization-engine` se implementará en TypeScript puro y expondrá una API de dominio explícita. Vitest será el framework de pruebas.

## Consequences

El motor será portable y fácil de probar de forma aislada. Las integraciones deberán traducir sus datos hacia el modelo del motor y no introducir dependencias de infraestructura en él.
