# Superkey Detection

## Definición formal

Sea `R` una relación, `X` un conjunto de atributos y `F` un conjunto de dependencias funcionales. `X` es una superclave de `R` respecto de `F` si y sólo si:

```text
R.attributes ⊆ X+
```

donde `X+` es el cierre de atributos de `X` bajo `F`.

## API y algoritmo

`isSuperkey(attributes, relation, dependencies)` recibe un `AttributeSet`, una `Relation` y un `Iterable<FunctionalDependency>`, y devuelve un booleano.

El algoritmo reutiliza `attributeClosure` para calcular `X+` y comprueba si todos los atributos de la relación están contenidos en ese cierre. No duplica la lógica de cierre, no muta sus entradas y no tiene efectos secundarios.

Por ejemplo, para `R(A, B, C)` y `F = { A → B, B → C }`, el cierre `A+ = {A, B, C}`; por tanto, `A` es superclave.

## Universo de atributos

Superkey Detection es una operación relativa a una relación concreta. Por tanto, su universo es exclusivamente `R.attributes` y exige:

```text
X ⊆ R.attributes
```

y, para toda dependencia `Y → Z` de `F`:

```text
Y ⊆ R.attributes
Z ⊆ R.attributes
```

Si el conjunto de entrada o cualquier lado de una dependencia contiene atributos externos, la operación produce un error de dominio explícito. No ignora atributos externos, no los elimina y no proyecta automáticamente las dependencias. La validación reside en esta operación; `attributeClosure` sigue siendo una primitiva genérica sin conocimiento de `Relation`.

Los conflictos de identidad (`same id / different name`) mantienen la política del Domain Model existente y también producen un error.

## Superkey y candidate key

Una superclave determina todos los atributos de la relación, pero puede contener atributos redundantes. Una candidate key es una superclave mínima: si se elimina cualquiera de sus atributos, deja de ser superclave.

Toda candidate key es superkey, pero no toda superkey es candidate key. La API
pública `findCandidateKeys` enumera precisamente las superkeys mínimas por
inclusión.
