# Proyección de dependencias funcionales

## Definición

Dada una relación `R`, un conjunto de dependencias `F` y un subesquema
`S ⊆ R.attributes`, la proyección de `F` sobre `S` es:

```text
πS(F) = { X → Y | X ⊆ S, Y ⊆ S, F ⊨ X → Y }
```

La operación pública es
`projectFunctionalDependencies(relation, dependencies, attributes)`, donde
`attributes` representa `S`. Tanto `S` como ambos lados de todas las FDs deben
estar dentro del scope de `R`; las colisiones de identidad de atributos también
se rechazan con la política común del motor.

**FD Projection ≠ filtering original FDs.** Filtrar sólo conserva dependencias
escritas cuyos atributos ya pertenecen a `S`; proyectar conserva todas las
implicaciones lógicas relevantes, incluidas las inferidas a través de atributos
que no están en `S`.

Por ejemplo, con `F = { A → B, B → C }` y `S = {A,C}`, ninguna FD original
queda íntegramente dentro de `S`. Sin embargo, `A+` bajo `F` contiene `C`, así
que la proyección contiene `A → C`.

## Algoritmo exhaustivo

La implementación prioriza corrección para subesquemas pequeños:

1. Enumera cada subconjunto `X ⊆ S`, incluido `∅`.
2. Calcula `X+` con `attributeClosure(X, F)` sobre las dependencias originales.
3. Restringe el resultado a `(X+ ∩ S) − X`.
4. Emite una FD `X → A` por cada atributo restante `A`.
5. Pasa todas las dependencias descubiertas por `findMinimalCover`.

Restar `X` evita generar dependencias triviales. Las FDs se crean con RHS
unitario y Minimal Cover descarta duplicados, atributos extraneous y FDs
redundantes. No se emiten RHS vacíos porque no imponen restricciones.

El determinante vacío participa como cualquier otro subconjunto. Para
`F = { ∅ → A, A → B }` y `S = {B}`, el cierre de `∅` contiene `B`, por lo que se
descubre y conserva `∅ → B`. Proyectar sobre `S = ∅` también termina: el único
subconjunto enumerado es `∅` y el resultado no contiene FDs no triviales.

## Reducción y determinismo

La proyección no expone el cierre completo y redundante. Reutiliza
`findMinimalCover`, de modo que existe una única política de reducción en el
motor: RHS unitario, ningún atributo extraneous en el LHS, ninguna FD redundante,
deduplicación y orden estable por IDs. `AttributeSet.toArray()` aporta el orden
canónico para enumerar `S`, así que reordenar atributos o dependencias de entrada
no cambia la salida canonicalizada.

## Complejidad

Con `m = |S|`, se enumeran `2^m` determinantes y se calcula un cierre por cada
uno. A ese coste exponencial se suma la construcción y reducción del conjunto
descubierto mediante Minimal Cover. Es una decisión consciente del MVP: evita
heurísticas incompletas y está dirigida a subesquemas pequeños.

## Uso en BCNF Decomposition

La descomposición BCNF conserva `R` y `F` originales y, para cada subrelación
con atributos `S`, invoca:

```ts
projectFunctionalDependencies(originalRelation, originalDependencies, S)
```

El analizador BCNF recibe así dependencias explícitas e inferidas válidas en la
subrelación.
