# SchemaWise

SchemaWise es una aplicación web para analizar y normalizar esquemas de bases de datos relacionales. El usuario definirá relaciones, atributos y dependencias funcionales; un motor determinístico explicará los resultados de los análisis de normalización.

## Estructura

- `apps/web`: futura interfaz React + TypeScript + Vite.
- `apps/api`: futura API Node.js + TypeScript.
- `packages/normalization-engine`: núcleo de dominio en TypeScript puro, independiente de Web, HTTP, PostgreSQL e infraestructura.
- `docs`: requisitos, arquitectura, decisiones y documentación de algoritmos.

La dirección de dependencias prevista es `Web → API → Normalization Engine`. El motor no debe importar desde `apps/*`.

## Desarrollo

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
npm run typecheck
npm test
npm run build
```

Esta baseline no implementa algoritmos de normalización, persistencia, autenticación ni una UI funcional.
