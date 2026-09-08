# Arquitectura — Modelo de dominio

Este documento define las primitivas inmutables del dominio implementadas por
`@schemawise/normalization-engine`. Los algoritmos de normalización todavía no
forman parte de este modelo.

## Attribute

Un `Attribute` representa una propiedad atómica mediante un `id` string interno
no vacío y un `name` visible no vacío. El `id` es la identidad lógica. Dos
representaciones con el mismo `id` son compatibles sólo si también conservan el
mismo `name`; comparar versiones con nombres distintos produce un conflicto de
identidad. La instancia se crea con `Attribute.create` y sus propiedades son de
sólo lectura.

## AttributeSet

Un `AttributeSet` encapsula una colección indexada por `id` y elimina duplicados por
identidad lógica. Expone membership, tamaño, subset, igualdad, unión, diferencia y una
vista ordenada de lectura (`toArray`). La igualdad de atributos se basa en `id`,
por lo que las operaciones usan esa identidad lógica. No se expone la colección
interna mutable: el backing store usa encapsulación privada de runtime y la
instancia queda congelada al construirse.

La identidad tiene una invariante adicional: un mismo `id` debe conservar el mismo
`name` visible dentro de una operación o conjunto. Dos atributos con el mismo `id` y
el mismo `name` son compatibles y se deduplican; si comparten `id` pero sus nombres
difieren, la construcción, comparación o combinación falla con un error de conflicto de identidad.
Así se evita elegir silenciosamente uno de los nombres.

## Relation

Una `Relation` representa el esquema analizado y contiene un nombre no vacío y
un `AttributeSet` no vacío. Se crea con `Relation.create`; no deriva todavía
claves, dependencias ni formas normales.

## FunctionalDependency

Una `FunctionalDependency` expresa que un conjunto de atributos determina otro conjunto de atributos. Conceptualmente se representa como:

```text
left: AttributeSet
right: AttributeSet
```

Una `FunctionalDependency` contiene dos `AttributeSet` inmutables (`left` y
`right`). Acepta lados simples, compuestos y conjuntos vacíos; no realiza
inferencia, cierre, minimal cover ni reglas de Armstrong. Su factory sí valida
que no exista una colisión de identidad entre ambos lados.

## Decisiones de representación

Se eligieron clases pequeñas con factories y propiedades de sólo lectura. Los
strings son suficientes para identidad lógica, son serializables y fáciles de
usar en operaciones determinísticas de conjuntos, sin introducir UUID ni
dependencias externas. La igualdad de `Attribute` es lógica por `id`, no por
referencia; los demás conceptos se comparan mediante sus operaciones o valores
expuestos, sin una jerarquía DDD adicional.
