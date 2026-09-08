# Normalization Engine v1

SchemaWise Normalization Engine v1 es el núcleo matemático determinístico para
analizar y transformar esquemas relacionales a partir de dependencias
funcionales válidas. Es independiente de Web, HTTP, persistencia e
infraestructura.

## Domain Model

- `Attribute`: identidad lógica (`id`) y nombre visible (`name`). Una misma
  identidad debe conservar el mismo nombre dentro de una operación.
- `AttributeSet`: conjunto inmutable de atributos, deduplicado por identidad y
  validado contra colisiones de identidad.
- `Relation`: relación con un conjunto de atributos.
- `FunctionalDependency`: dependencia `X → Y` con lados inmutables; valida la
  compatibilidad de identidad entre LHS y RHS.

## Fundamental Algorithms

- Attribute Closure (`X+`)
- Superkey Detection
- Candidate Key Discovery
- Prime Attributes
- Minimal Cover
- Functional Dependency Projection

## Normal Form Analysis

Incluye análisis de 2NF, 3NF y BCNF, con detección de las violaciones
correspondientes y uso de claves y cierres según cada contrato.

`1NF is an external precondition`. SchemaWise v1 no intenta inferir 1NF
mediante Functional Dependencies.

## Transformations

- 3NF Synthesis
- BCNF Decomposition

## Formal Guarantees

3NF Synthesis garantiza:

- resultado en 3NF;
- preservación de dependencias;
- lossless join por construcción.

BCNF Decomposition garantiza:

- hojas en BCNF;
- lossless join mediante descomposición binaria;
- la preservación de dependencias no está garantizada.

Para cualquier descomposición válida está disponible Dependency Preservation
Analysis, que permite analizar explícitamente si las dependencias se preservan.

## Deferred

Quedan fuera de Engine v1:

- general lossless-join checker / chase;
- detección de 1NF;
- 4NF;
- 5NF;
- multivalued dependencies;
- join dependencies.

## Complexity

Varias operaciones, especialmente la búsqueda de claves, la proyección y las
transformaciones, pueden ser exponenciales. La implementación está diseñada
inicialmente para esquemas educativos, prácticos pequeños y medianos; no
promete escalabilidad ilimitada.

