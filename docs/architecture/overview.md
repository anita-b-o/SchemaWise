# Arquitectura — Overview

SchemaWise se organiza como un monorepo con tres zonas principales:

```text
Web → API → Normalization Engine
```

## Web

`apps/web` será la interfaz React + TypeScript + Vite. Se ocupará de capturar la entrada del usuario y presentar resultados y explicaciones. No contiene reglas de normalización.

## API

`apps/api` será el límite de transporte y aplicación. Recibirá solicitudes de la Web, validará y transformará los datos de entrada, invocará el motor y devolverá respuestas. La API no debe duplicar algoritmos del dominio.

## Normalization Engine

`packages/normalization-engine` es el núcleo de dominio en TypeScript puro. Contendrá el modelo y los algoritmos determinísticos de análisis. Debe permanecer independiente de React, HTTP, PostgreSQL, ORM, autenticación y cualquier otra infraestructura.

El motor no puede importar desde `apps/*`. Las dependencias deben apuntar hacia el dominio, no desde el dominio hacia adaptadores o interfaces.
