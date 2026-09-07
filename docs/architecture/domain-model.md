# Arquitectura — Modelo de dominio

Este documento define conceptos del dominio, no una implementación concreta.

## Attribute

Un `Attribute` representa una propiedad atómica que participa en una relación y en dependencias funcionales. Su identidad debe estar separada de su nombre visible: el nombre es una etiqueta para usuarios y puede cambiar sin alterar necesariamente la identidad del atributo. Todavía no se decide si esa identidad será un UUID, un identificador numérico u otra representación.

## AttributeSet

Un `AttributeSet` es una colección matemática de `Attribute` sin duplicados. El orden no debe tener significado semántico, aunque una implementación pueda elegir una representación ordenada para serialización o presentación.

## Relation

Una `Relation` representa el esquema analizado y contiene un nombre y un conjunto de atributos. Las dependencias funcionales asociadas al esquema describen restricciones sobre sus instancias.

## FunctionalDependency

Una `FunctionalDependency` expresa que un conjunto de atributos determina otro conjunto de atributos. Conceptualmente se representa como:

```text
left: AttributeSet
right: AttributeSet
```

La forma concreta de validar, normalizar o serializar estos conceptos se decidirá junto con la implementación del motor.
