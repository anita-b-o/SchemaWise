# SchemaWise — MVP

## Objetivo

SchemaWise será una aplicación web para analizar y normalizar esquemas de bases de datos relacionales. El sistema debe permitir que el usuario describa un esquema y, posteriormente, obtener resultados determinísticos con explicaciones comprensibles.

## Entrada

La entrada conceptual está compuesta por:

- una relación;
- sus atributos;
- sus dependencias funcionales.

Una dependencia funcional relaciona un conjunto de atributos del lado izquierdo con un conjunto de atributos del lado derecho.

## Capacidades futuras del motor

- Attribute Closure.
- Superkeys.
- Candidate Keys.
- Prime Attributes.
- Minimal Cover.
- 1NF, 2NF, 3NF y BCNF.
- Detección y explicación de violaciones de formas normales.
- Síntesis y descomposición a 3NF.

Cada resultado deberá poder explicar por qué se llegó a esa conclusión.

## Fuera del MVP

- 4NF y 5NF.
- Dependencias multivaluadas.
- Join dependencies.
- IA como fuente de verdad.
- Colaboración multiusuario.
- Pagos.

Esta baseline tampoco incluye persistencia, autenticación, PostgreSQL ni una interfaz de usuario funcional.
