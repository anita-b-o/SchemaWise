# Arquitectura — Overview

SchemaWise se organiza como un monorepo con tres zonas principales:

```text
Web → API → Normalization Engine
```

## Web

`apps/web` es la interfaz React + TypeScript + Vite. Captura la entrada del usuario y presenta resultados y explicaciones. No contiene reglas de normalización.

## API

`apps/api` es el límite de transporte y aplicación. Recibe solicitudes de la Web, valida y transforma los datos de entrada, invoca el motor y devuelve respuestas. La API no duplica algoritmos del dominio.

## Normalization Engine

`packages/normalization-engine` es el núcleo de dominio en TypeScript puro. Contiene el modelo y los algoritmos determinísticos de análisis. Permanece independiente de React, HTTP, PostgreSQL, ORM, autenticación y cualquier otra infraestructura.

El motor no puede importar desde `apps/*`. Las dependencias deben apuntar hacia el dominio, no desde el dominio hacia adaptadores o interfaces.
