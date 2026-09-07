# Descomposición a forma normal de Boyce-Codd

## Objetivo y contrato

`decomposeToBoyceCoddNormalForm(relation, dependencies)` transforma una relación
en una colección de subesquemas cuyas hojas satisfacen BCNF. Conserva evidencia
estructurada de cada división binaria y no inventa nombres, claves, foreign keys
ni metadata persistente.

El algoritmo busca dos propiedades: BCNF en cada hoja y lossless join para la
descomposición completa. A diferencia de 3NF Synthesis, **no garantiza dependency
preservation** y la API no afirma ni intenta comprobar esa propiedad.

## Proyección y detección de violaciones

Cada nodo con atributos `S` se analiza exclusivamente con:

```ts
projectFunctionalDependencies(originalRelation, originalDependencies, S)
```

Esto no es un filtrado de las FDs originales. La proyección incluye implicaciones
válidas en `S` aunque atraviesen atributos externos. Por ejemplo, `A → B` y
`B → C` proyectadas sobre `{A,C}` permiten utilizar `A → C`.

Sobre esa proyección se ejecuta `analyzeBoyceCoddNormalForm`. Una FD no trivial
`X → A` viola BCNF cuando `X` no es superkey de `S`. El analizador devuelve sus
violaciones ordenadas por cardinalidad de `X`, IDs lexicográficos de `X` e ID de
`A`; la descomposición elige siempre la primera.

Esta selección hace determinista el resultado, pero no implica que la
descomposición BCNF sea única: elegir otra violación válida puede producir otra
colección de relaciones.

## División, recursión y terminación

Para una violación general `X → Y`, la regla es:

```text
R1 = X ∪ Y
R2 = R − (Y − X)
```

El analizador actual entrega dependientes unitarios, pero la implementación
mantiene la fórmula formal: construye `Y = {A}`, calcula `Y − X` y sólo entonces
lo resta del esquema fuente.

Los pasos se registran en preorden depth-first. Después se procesa primero `R1`
y luego `R2`, proyectando nuevamente las FDs originales en cada hijo. Una hoja
se conserva cuando su análisis satisface BCNF. Las hojas duplicadas se eliminan
por su conjunto de IDs y se ordenan por cardinalidad y después por IDs
lexicográficos.

Antes de recursar se exige que ambos hijos sean no vacíos, estén estrictamente
contenidos en el padre, su unión sea el padre y su intersección sea `X`. Una
violación no trivial válida cumple estas condiciones; si no se cumplen, se lanza
un error de invariante en vez de ocultar el fallo o entrar en recursión infinita.
Como toda rama reduce estrictamente la cantidad de atributos, la recursión
termina.

## Garantía lossless

En cada paso:

```text
R1 ∩ R2 = X
X → Y
X → R1
```

Por ello la descomposición binaria es lossless. La implementación registra el
padre, `X → A` y ambos hijos; los tests comprueban que los hijos cubren al padre,
que su intersección es `X` y que `A` pertenece al cierre de `X` bajo la proyección
del padre. Al reemplazar recursivamente una relación por otra descomposición
lossless, la composición completa conserva lossless join sin necesitar un chase
general.

## BCNF y dependency preservation

Cada hoja se obtiene sólo cuando el analizador BCNF, ejecutado con la proyección
correspondiente, devuelve `satisfied: true`. Los tests vuelven a proyectar y
analizar todas las hojas de casos representativos.

BCNF puede perder dependency preservation. Los pasos dejan suficiente evidencia
para un verificador posterior, pero esta API no calcula cierres sobre la unión de
proyecciones ni promete que todas las FDs originales puedan imponerse localmente.

## Complejidad

El coste no es polinómico. Cada nodo puede ejecutar FD Projection, que enumera
`2^|S|` determinantes y reduce el resultado con Minimal Cover, y BCNF Analysis,
que también enumera subconjuntos y calcula cierres. El árbol contiene múltiples
nodos, aunque cada rama disminuye estrictamente de tamaño. El peor caso combina
el crecimiento exponencial de esas operaciones con todos los nodos generados.

## Diferencia con 3NF Synthesis

3NF Synthesis busca simultáneamente 3NF, dependency preservation y lossless join;
agrupa un minimal cover y agrega una candidate key cuando hace falta. BCNF
Decomposition aplica divisiones binarias guiadas por violaciones para alcanzar
BCNF y garantizar lossless join, pero puede sacrificar dependency preservation.
Son contratos distintos y ninguno debe usarse para prometer las propiedades del
otro.
