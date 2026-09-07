# Attribute Closure

## Contrato

`attributeClosure(attributes, dependencies)` calcula el cierre de atributos `X+` bajo dependencias funcionales `F`.

- `attributes`: el `AttributeSet` inicial, `X`.
- `dependencies`: un `Iterable<FunctionalDependency>`, `F`.
- resultado: un nuevo `AttributeSet` con los atributos de `X+`.

Attribute Closure no necesita conocer `Relation`. La relación será necesaria más adelante para decidir si un cierre cubre todos sus atributos durante la detección de superkeys.

Todos los atributos participantes deben respetar la invariante de identidad del dominio: un mismo `id` no puede tener nombres visibles distintos. Un conflicto produce un error en lugar de permitir una inferencia ambigua.

## Algoritmo

El algoritmo comienza con una copia de `X`. Mientras alguna dependencia `Y → Z` tenga su lado izquierdo contenido en el cierre actual, incorpora `Z`. Cada pasada continúa hasta que ninguna dependencia agregue atributos nuevos.

Termina porque el universo de atributos de la operación es finito y cada cambio incrementa estrictamente el tamaño del cierre. Las dependencias triviales, ciclos y lados derechos vacíos no producen cambios adicionales.

## Ejemplo

Con atributos `A`, `B`, `C`, `D` y dependencias:

```text
A  → B
B  → C
AC → D
```

el cálculo parte de `{A}`, incorpora sucesivamente `B`, `C` y `D`:

```text
A+ = {A, B, C, D}
```

## Relación futura con Superkey Detection

Para una relación `R`, un conjunto `X` será superkey cuando `X+` incluya todos los atributos de `R`. Esa comparación pertenece al algoritmo futuro de Superkey Detection; este algoritmo sólo calcula el cierre y no recibe una relación.
