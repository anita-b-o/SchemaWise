# Minimal Cover

## Definición y equivalencia

Un *minimal cover* de un conjunto de dependencias funcionales `F` sobre una relación `R` es un conjunto `G` equivalente a `F` que cumple tres condiciones:

1. cada dependencia de `G` tiene un único atributo en el RHS;
2. ningún atributo de un LHS es extraneous;
3. ninguna dependencia completa es redundante.

La equivalencia significa que ambos conjuntos implican exactamente las mismas dependencias funcionales: `F+ = G+`. SchemaWise valida primero que todos los atributos de `F` pertenecen a `R.attributes`; no ignora atributos externos ni proyecta dependencias automáticamente. Las colisiones de identidad por un mismo ID y distinto nombre también son errores.

## Pipeline

Las transformaciones se ejecutan en este orden:

### 1. RHS unitario

Cada dependencia con varios atributos a la derecha se descompone mediante la regla de descomposición:

```text
A → BC
```

se convierte en:

```text
A → B
A → C
```

### 2. Atributos extraneous en el LHS

Para cada dependencia `X → A` y cada `b ∈ X`, SchemaWise calcula `(X − {b})+` con el cover vigente. Si el cierre contiene `A`, reemplaza la dependencia por `(X − {b}) → A`. Los cálculos usan nuevos `AttributeSet` y no mutan el conjunto que se está examinando.

Ejemplo:

```text
AB → C
A → B
```

Como `C ∈ A+`, `B` es extraneous y `AB → C` se reduce a `A → C`.

### 3. Dependencias redundantes

Para cada `X → A`, se calcula `X+` usando el cover sin esa dependencia. Si el cierre contiene `A`, la dependencia se elimina.

Ejemplo:

```text
A → B
B → C
A → C
```

`A → C` es redundante porque se deriva de las otras dos dependencias.

Los duplicados se eliminan después de la descomposición y de la reducción de LHS. El resultado se ordena por cardinalidad del LHS, IDs del LHS en orden lexicográfico y, finalmente, ID del RHS. Así, el orden de entrada no afecta el resultado serializado. Un minimal cover matemático puede no ser único; esta política selecciona de forma reproducible el producido por este pipeline.

## LHS y RHS vacíos

Un LHS vacío es válido. Por ejemplo, `∅ → A` expresa que `A` queda determinado sin atributos de partida y participa normalmente en los cálculos de cierre y minimalidad.

Una dependencia `X → ∅` se elimina explícitamente durante la descomposición. Su RHS es subconjunto de cualquier cierre, por lo que la dependencia es trivial, impone cero restricciones y es implicada por todo conjunto de dependencias, incluido el conjunto vacío. Mantenerla contradiría además la forma de RHS unitario sin aportar información a `F+`.

Por la misma razón, una dependencia trivial como `AB → A` desaparece en la etapa de redundancia: `A` ya pertenece al cierre inicial de `AB`.

## Ejemplo combinado

Para:

```text
F = { AB → CD, A → B, C → D, A → D }
```

la descomposición produce `AB → C` y `AB → D`; `B` se elimina de ambos LHS; y las copias o consecuencias redundantes de `A → D` se eliminan. El cover canónico resultante es:

```text
G = { A → B, A → C, C → D }
```

## Complejidad práctica

El costo dominante son los cierres repetidos. Un cierre es aproximadamente `O(|F| · |R|)` con las estructuras actuales. Se calcula uno por atributo candidato del lado izquierdo y uno por dependencia al comprobar redundancia, por lo que el comportamiento práctico es aproximadamente `O((L + |F|) · |F| · |R|)`, donde `L` es el número total de apariciones de atributos en los LHS después de descomponer. La canonicalización añade ordenamientos de costo menor para conjuntos habituales.

## Relación con otros algoritmos

```text
Minimal Cover ≠ Candidate Keys
```

Minimal Cover simplifica un conjunto de dependencias sin cambiar lo que implica. Candidate Key Discovery busca conjuntos mínimos de atributos cuyo cierre cubre toda la relación. Ambas operaciones usan Attribute Closure, pero resuelven problemas distintos.

Una futura síntesis a 3NF podrá consumir un minimal cover para construir esquemas a partir de dependencias con RHS unitario y sin redundancias. Esa síntesis, al igual que el análisis de 2NF/3NF, queda fuera de este algoritmo.
