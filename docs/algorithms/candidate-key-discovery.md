# Candidate Key Discovery

## Definición

Una candidate key `K` de una relación `R` respecto de un conjunto de dependencias funcionales `F` es una superclave mínima por inclusión:

```text
R.attributes ⊆ K+
```

y ningún subconjunto propio `S ⊂ K` es superclave. Esto no equivale a elegir solamente las superclaves de menor cardinalidad global: candidate keys distintas pueden tener tamaños diferentes.

Superkey Detection responde si un conjunto dado determina toda la relación. Candidate Key Discovery encuentra todos los conjuntos que cumplen esa propiedad sin contener una superclave propia. Ambos se apoyan en Attribute Closure; la implementación comparte la misma comprobación interna de cobertura del cierre y no duplica su lógica matemática.

## Universo y atributos obligatorios

La búsqueda y todas las dependencias están restringidas a `R.attributes`. Una FD con LHS o RHS externo produce el mismo tipo de error de scope que Superkey Detection; no se ignora ni se proyecta.

Si un atributo de la relación nunca aparece en ningún RHS, ninguna dependencia puede incorporarlo a un cierre. Por ello debe estar inicialmente en toda candidate key. La búsqueda parte de:

```text
mandatory = R.attributes − RHS(F)
```

El resto de los atributos son opcionales y se combinan con esta base.

## Exploración, minimalidad y poda

Los atributos opcionales se ordenan por `id` y sus combinaciones se exploran por cardinalidad creciente y, dentro de cada cardinalidad, en orden lexicográfico. Esta política sólo hace determinista la representación del resultado; no atribuye significado matemático al orden.

Para cada conjunto `mandatory ∪ combination`, se comprueba si su cierre cubre `R.attributes`. Como todos sus subconjuntos explorables ya se visitaron, una superclave nueva es mínima por inclusión siempre que no contenga una candidate key hallada. Una vez encontrada una clave `K`, todo candidato `X` con `K ⊆ X` se poda antes de calcular su cierre, pues no puede ser mínimo.

El conjunto vacío se considera normalmente: si `∅+` cubre la relación, `∅` es la candidate key.

## Complejidad

Si hay `m` atributos opcionales, en el peor caso se exploran `2^m` subconjuntos. Cada comprobación calcula un cierre con coste polinómico respecto del número de atributos y dependencias, pero la búsqueda completa sigue siendo exponencial. Los atributos obligatorios y la poda de supersets reducen trabajo en muchos casos sin cambiar la corrección; el MVP no intenta ocultar ni eliminar el peor caso exponencial.

## Ejemplo con múltiples claves

Para:

```text
R(A, B, C)
F = { A → B, B → A }
```

`C` no aparece en ningún RHS, por lo que es obligatorio. Tanto `{A, C}+` como `{B, C}+` cubren la relación, y eliminar cualquier atributo de cualquiera de esos conjuntos destruye esa propiedad. Las candidate keys son `{A, C}` y `{B, C}`.
