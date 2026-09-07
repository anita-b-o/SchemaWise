# ADR 001: Monorepo con npm workspaces

## Status

Accepted

## Context

SchemaWise necesita mantener una Web, una API y un motor de dominio relacionado, con límites claros y comandos de desarrollo sencillos.

## Decision

Usaremos un monorepo basado en npm workspaces, con `apps/*` para aplicaciones y `packages/*` para paquetes compartidos.

## Consequences

La instalación y los scripts pueden ejecutarse desde la raíz y las dependencias se gestionan en un único lockfile. Se acepta que el crecimiento futuro del repositorio pueda requerir convenciones o tooling adicional.
