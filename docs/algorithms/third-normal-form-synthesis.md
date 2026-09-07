# Síntesis a tercera forma normal (3NF)

## Objetivo y modelo de salida

`synthesizeThirdNormalForm(R, F)` construye una colección determinística de
esquemas de atributos en 3NF equivalente para los fines de dependencias
funcionales. No responde si `R` ya cumple 3NF y no crea tablas SQL.

Las relaciones sintetizadas se representan mediante `SynthesizedRelation`, un
valor pequeño con un `AttributeSet` y un origen estructurado: `minimal-cover` o
`candidate-key`. No se reutiliza `Relation` porque ésta exige un nombre y la
síntesis todavía no tiene nombres persistentes ni semántica de PK, FK o UI.

El resultado también expone el minimal cover utilizado y
`addedCandidateKey`, que es `null` o la key agregada para distinguir esta
garantía de las relaciones derivadas de dependencias.

## Algoritmo

1. Se calcula `G = findMinimalCover(R, F)`. La síntesis reutiliza el algoritmo
   existente; no vuelve a implementar la reducción. Cada FD de `G` tiene RHS
   unitario.
2. Las FDs con el mismo LHS `X` se agrupan en un esquema `X ∪ {A₁, …, Aₙ}`.
3. Los esquemas iguales se deduplican y todo esquema estrictamente contenido
   en otro se elimina. Una FD asociada al esquema eliminado continúa siendo
   local en el esquema contenedor.
4. Se calculan las candidate keys con la política existente. Si ningún esquema
   contiene una key completa, se agrega el primer resultado canónico de
   `findCandidateKeys`. Con `F = ∅`, la key es todo `R`, por lo que la salida no
   queda vacía.

Un LHS vacío es válido. Por ejemplo, para `R(A,B,C)`, `∅ → A` y `A → B`, los
esquemas derivados se reducen a `{A,B}` y se agrega la candidate key `{C}`.

## Garantías

### Dependency preservation

Para cada `X → A` de `G`, se crea un esquema que contiene `X ∪ {A}`. Si ese
esquema se elimina por contención, el esquema que lo contiene conserva ambos
lados de la FD. Por tanto cada dependencia del minimal cover puede comprobarse
localmente, y como `G` equivale a `F`, la descomposición preserva `F`.

### Lossless join

El algoritmo asegura estructuralmente que al menos un esquema resultante
contenga una candidate key de `R`: usa uno ya derivado o agrega una relación de
key. Ésta es la condición del teorema de síntesis clásica que garantiza un join
sin pérdida. No hace falta ejecutar un chase general para esta construcción
específica; esta iteración no expone un verificador general de lossless join.

### Tercera forma normal

En cada esquema agrupado, el LHS común determina todos sus atributos y por ello
es una key del esquema. El paso de contención sólo conserva un esquema mayor en
el que las dependencias cubiertas siguen siendo locales. La relación adicional
contiene únicamente una candidate key mínima, por lo que una dependencia
proyectada no trivial no puede hacer redundante uno de sus atributos. Ésta es
la garantía estructural del algoritmo clásico. Los tests además enumeran la
proyección de FDs para casos representativos y ejecutan `analyzeThirdNormalForm`
sobre cada esquema; no se agrega una API pública de proyección general.

## Determinismo y complejidad práctica

Los atributos se identifican por ID. Las relaciones se deduplican y se ordenan
por cardinalidad y luego por la lista lexicográfica de IDs. La candidate key
adicional es la primera de `findCandidateKeys`, que aplica la misma política
canónica. Reordenar atributos o dependencias no altera ni los conjuntos ni el
orden de salida.

Además del costo de minimal cover y candidate keys, agrupar es lineal en el
número de FDs del cover y eliminar contenciones compara pares de esquemas. El
costo dominante práctico suele ser el descubrimiento de candidate keys, que
puede ser exponencial en el número de atributos.

## Análisis frente a síntesis

`analyzeThirdNormalForm` responde: **¿R ya está en 3NF?** Devuelve violations
del esquema recibido y no lo transforma.

`synthesizeThirdNormalForm` responde: **¿qué esquema 3NF equivalente podemos
obtener?** Devuelve esquemas derivados y evidencia estructural mínima, sin
mezclar diagnóstico, SQL ni decisiones de presentación.
