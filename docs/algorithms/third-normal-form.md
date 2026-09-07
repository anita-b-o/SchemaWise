# Tercera Forma Normal (3NF)

## Precondición de 1NF

El análisis de 3NF opera bajo la precondición explícita de que la relación está en Primera Forma Normal (1NF).

**SchemaWise actualmente no afirma ni verifica 1NF a partir de Functional Dependencies.** Las dependencias funcionales no describen si los valores o dominios son atómicos. Esa condición deberá provenir en el futuro de la UI o de un modelo de schema enriquecido.

## Definición formal

Para toda dependencia funcional no trivial `X → A` implicada por `F`, una relación satisface 3NF si se cumple al menos una de estas condiciones:

```text
X es superkey
OR
A es prime attribute
```

La dependencia es no trivial cuando `A ∉ X`. Un conjunto es superkey cuando su cierre contiene todos los atributos de la relación. Un atributo es prime cuando pertenece a al menos una candidate key.

Por tanto, sólo hay una violación si simultáneamente `A ∉ X`, `X` no es superkey y `A` no es prime.

Buscar patrones textuales de “transitividad” no es la regla formal: algunas violaciones pueden explicarse pedagógicamente como transitivas, pero la fuente de verdad es la condición anterior aplicada a `F+`.

## Exhaustividad y diagnóstico

`analyzeThirdNormalForm(relation, dependencies)` enumera cada subconjunto `X ⊆ R.attributes`, calcula `X+` y considera cada `A ∈ X+ − X`. Así incluye dependencias escritas e inferidas. No presupone que inspeccionar únicamente un minimal cover sea suficiente para producir los diagnósticos exhaustivos.

El resultado es:

```ts
interface ThirdNormalFormAnalysis {
  readonly satisfied: boolean;
  readonly violations: readonly ThirdNormalFormViolation[];
}

interface ThirdNormalFormViolation {
  readonly determinant: AttributeSet;
  readonly dependent: Attribute;
}
```

El tipo de violación implica que `determinantIsSuperkey = false` y `dependentIsPrime = false`; no se duplican esos datos. El resultado, el array y cada evidencia se congelan. Los pares matemáticamente idénticos `(X, A)` se deduplican por IDs y se ordenan por cardinalidad de `X`, IDs lexicográficos de `X` e ID de `A`.

Los determinantes vacíos se analizan normalmente. Si `∅` es superkey, satisface la primera alternativa. Si no lo es y determina un atributo non-prime, `∅ → A` es una violación.

## Ejemplo

Para:

```text
R(A, B, C)
F = { A → B, B → C }
```

`A` es candidate key, por lo que es el único atributo prime. `B → C` es no trivial, `B` no es superkey y `C` no es prime. El diagnóstico contiene:

```text
determinant = {B}
dependent = C
```

## Complejidad

Para `n` atributos se exploran `2^n` determinantes y se calcula un cierre por cada uno; el mismo cierre permite comprobar si el determinante es superkey y enumerar sus dependientes. Con las estructuras actuales, cada cierre recorre repetidamente las dependencias hasta alcanzar un punto fijo. El tiempo es exponencial en `n`; los resultados también pueden ser exponenciales. Este coste es deliberado y aceptable para los esquemas pequeños del MVP.
