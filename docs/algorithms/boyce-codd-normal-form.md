# Boyce-Codd Normal Form (BCNF)

El análisis asume explícitamente que la relación ya cumple 1NF. SchemaWise no
infiere 1NF a partir de dependencias funcionales.

## Definición

Una relación `R` está en BCNF respecto de `F` si para toda dependencia
funcional no trivial implicada `X → A`, `X` es una superkey de `R`. Una
dependencia es no trivial cuando `A ∉ X`; `X` es superkey cuando `X+` contiene
todos los atributos de `R`.

La diferencia con 3NF es exacta: 3NF permite `X` no superkey si `A` es prime;
BCNF no tiene esa excepción. Por ello:

```text
BCNF ⇒ 3NF
3NF ⇏ BCNF
```

Por ejemplo, en `R(A,B,C)` con `AB → C` y `C → B`, las candidate keys son
`AB` y `AC`; por tanto todos los atributos son prime. La relación cumple 3NF,
pero `C → B` viola BCNF porque `C` no es superkey.

## Algoritmo y diagnostics

Se validan primero el scope de la relación y las identidades de los atributos.
Después se enumeran todos los subconjuntos `X ⊆ R.attributes`, se calcula
`X+` y se examina cada `A ∈ X+ − X`. Si `X+` no cubre la relación, se devuelve
la evidencia estructurada `{ determinant: X, dependent: A }`. Así se incluyen
dependencias implicadas por `F+`, no sólo las FDs escritas. Las evidencias
idénticas se deduplican.

Los diagnostics se ordenan primero por cardinalidad del determinante, luego
por sus IDs lexicográficos y finalmente por el ID del atributo dependiente.
El resultado y sus arrays/evidencias son inmutables y serializables.

## Complejidad

El enfoque exhaustivo explora `2^n` determinantes para `n` atributos y calcula
un cierre para cada uno. Cada cierre puede recorrer repetidamente todas las
dependencias hasta un punto fijo, por lo que el tiempo es exponencial en `n`;
el número de diagnostics también puede ser exponencial. Es una elección de
corrección y exhaustividad para esquemas pequeños.
