# ADR 003: Límites del Normalization Engine

## Status

Accepted

## Context

La aplicación necesita una dirección de dependencias estable: la Web presenta, la API coordina y el motor calcula.

## Decision

El motor no importará desde `apps/*` y permanecerá independiente de React, HTTP, PostgreSQL, ORM, autenticación y otras tecnologías de infraestructura. La dirección conceptual será `Web → API → Normalization Engine`.

## Consequences

Los algoritmos quedan aislados del transporte y la persistencia, lo que permite reutilizarlos y probarlos determinísticamente. La API deberá actuar como adaptador y no como segundo lugar para las reglas del dominio.
