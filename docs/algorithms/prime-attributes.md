# Prime Attributes

## Definición

Un atributo primo de una relación `R` respecto de un conjunto de dependencias funcionales `F` es un atributo que pertenece al menos a una candidate key. No necesita pertenecer a todas ellas.

```text
PrimeAttributes(R, F)
=
⋃ CandidateKeys(R, F)
```

SchemaWise obtiene primero todas las candidate keys de `(R, F)` y devuelve un `AttributeSet` con la unión matemática de sus atributos. Por ello Prime Attributes hereda de Candidate Key Discovery la validación del universo de la relación, la detección de colisiones de identidad y el orden determinista.

## Ejemplo con múltiples candidate keys

Para:

```text
R(A, B, C)
F = { A → B, B → A }
```

las candidate keys son `{A, C}` y `{B, C}`. Su unión es `{A, B, C}`, de modo que los tres atributos son primos. `A` y `B` son primos aunque cada uno aparezca solamente en una de las candidate keys.

## Distinción terminológica

```text
Candidate key ≠ Primary key
Prime attribute ≠ Primary-key attribute
```

Una candidate key es cualquier superclave mínima por inclusión. Una primary key es una candidate key seleccionada como identificador principal mediante una decisión de diseño. Por tanto, *prime* no significa *primary key*: un prime attribute pertenece a al menos una candidate key, no necesariamente a una primary key elegida.

SchemaWise todavía no selecciona primary keys.
