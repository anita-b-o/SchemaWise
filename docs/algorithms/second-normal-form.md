# Segunda Forma Normal (2NF)

## Precondición de 1NF

El análisis de 2NF opera bajo la precondición explícita de que la relación está en Primera Forma Normal (1NF).

**SchemaWise actualmente no afirma ni verifica 1NF a partir de Functional Dependencies.** El modelo actual sólo conoce la relación, sus atributos y sus dependencias funcionales. Esa información no describe la atomicidad ni la estructura interna de los valores o dominios necesaria para verificar 1NF. Una futura UI o un modelo de schema enriquecido podrá representar esa condición.

## Definición formal

Una *candidate key* es un conjunto mínimo de atributos cuyo cierre contiene todos los atributos de la relación. Un atributo es *prime* si pertenece a al menos una candidate key; en caso contrario es *non-prime*.

Bajo la precondición de 1NF, una relación está en 2NF si ningún atributo non-prime depende funcionalmente de un subconjunto propio de una candidate key. Para cada candidate key `K`, el analizador examina cada `X ⊂ K`. Si existe un atributo non-prime `A` tal que:

```text
A ∈ X+ − X
```

entonces `X → A` es una dependencia funcional parcial y se registra una violación.

El cierre se calcula contra todo `F`, por lo que la dependencia puede estar escrita explícitamente o ser una consecuencia inferida. No se limita el análisis a las dependencias de entrada ni a un minimal cover.

Los subconjuntos son matemáticos: incluyen `∅` cuando éste es subconjunto propio. Una candidate key vacía no tiene subconjuntos propios y, por tanto, no produce una dependencia parcial. No hay excepciones especiales para este caso.

## Diagnóstico

`analyzeSecondNormalForm(relation, dependencies)` devuelve:

```ts
interface SecondNormalFormAnalysis {
  readonly satisfied: boolean;
  readonly violations: readonly SecondNormalFormViolation[];
}

interface SecondNormalFormViolation {
  readonly candidateKey: AttributeSet;
  readonly determinant: AttributeSet;
  readonly dependent: Attribute;
}
```

Cada violación conserva la candidate key afectada, su determinante parcial y el atributo dependiente non-prime. El resultado, el array de violaciones y cada objeto de evidencia se congelan. `AttributeSet` expone una API sin mutadores.

## Ejemplo con clave compuesta

Para:

```text
R(A, B, C)
F = { AB → C, A → C }
```

`AB` es candidate key, `C` es non-prime y `A ⊂ AB`. Como `C ∈ A+`, el diagnóstico contiene:

```text
candidateKey = {A, B}
determinant = {A}
dependent = C
```

## Determinismo y complejidad

Las violaciones matemáticamente idénticas se deduplican por IDs. Se ordenan por cardinalidad del determinante, IDs lexicográficos del determinante, ID del dependiente y candidate key.

Para una candidate key de tamaño `k` se examinan `2^k - 1` subconjuntos propios. Con varias candidate keys, el peor caso suma ese espacio para cada una; cada subconjunto requiere un cierre. El comportamiento es exponencial y se acepta para relaciones pequeñas del MVP.
