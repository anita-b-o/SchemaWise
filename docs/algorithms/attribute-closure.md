# Attribute Closure

## Estado

Documentación conceptual; la implementación queda fuera de esta baseline.

## Definición

El attribute closure de un conjunto de atributos `X`, escrito `X+`, es el conjunto de atributos que pueden determinarse a partir de `X` usando las dependencias funcionales disponibles.

## Ejemplo

Para la relación:

```text
R(A, B, C, D)
```

y las dependencias:

```text
A  → B
B  → C
AC → D
```

el cierre de `A` se obtiene aplicando las dependencias repetidamente:

1. Se parte de `{A}`.
2. `A → B` permite agregar `B`.
3. `B → C` permite agregar `C`.
4. Ahora están disponibles `A` y `C`, por lo que `AC → D` permite agregar `D`.

Por tanto:

```text
A+ = {A, B, C, D}
```

## Importancia

Attribute Closure será la base para identificar superkeys y candidate keys, y posteriormente para analizar las formas normales y sus violaciones. El motor deberá producir también una explicación de las reglas aplicadas y del orden lógico de la derivación.
