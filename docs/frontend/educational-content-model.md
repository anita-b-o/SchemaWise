# Educational content model v1.1

## Purpose

Este modelo convierte evidencia matemática ya calculada en copy consistente y
accesible. No es un motor de inferencia ni un CMS. Su frontera es:

```text
typed DTO + immutable operation snapshot + static concept definitions
                              ↓
                    pure explanation builder
                              ↓
          Level 2 summary + optional Level 3 formal reasoning
```

Level 1 pertenece al componente de resultado existente: status, count, key,
cover o relation. Incluirlo de nuevo en cada explicación duplicaría view models.

## Why the initial shape is insufficient

La forma conceptual `title / summary / rule / evidence[] / conclusion /
concepts[]` mezcla campos siempre necesarios con otros contextuales:

- `title` ya existe en la jerarquía de resultados;
- una definición de glossary no tiene evidence/conclusion;
- una garantía algorítmica necesita provenance, que la propuesta no registra;
- strings planas no pueden dar nombres accesibles distintos a la notación;
- un array de evidence sin tipo permite inventar hechos que el DTO no sostiene.

Se adopta un núcleo menor y una sección formal opcional, con contenido
estructurado y procedencia explícita.

## Core model

La tranche 1 implementa este diseño en
`apps/web/src/features/explanations/educational-content.ts`, limitado a los
tokens y conceptos que ya consume la UI:

```ts
type ConceptId =
  | "functional-dependency"
  | "determinant"
  | "attribute-closure"
  | "superkey"
  | "candidate-key"
  | "primary-key"
  | "prime-attribute"
  | "partial-dependency"
  | "transitive-dependency"
  | "minimal-cover"
  | "1nf" | "2nf" | "3nf" | "bcnf"
  | "lossless-join"
  | "dependency-preservation";

type ContentToken =
  | { kind: "text"; value: string }
  | { kind: "attribute"; id: string }
  | { kind: "attribute-set"; ids: readonly string[] }
  | { kind: "functional-dependency"; dependency: FunctionalDependencyDto }
  | { kind: "closure"; ids: readonly string[] }
  | { kind: "relation"; snapshot: SchemaInputDto };

type ExplanationFact = {
  source: "dto" | "snapshot" | "operation-contract";
  content: readonly ContentToken[];
};

type FormalReasoningContent = {
  rule: readonly ContentToken[];
  evidence: readonly ExplanationFact[];
  conclusion: readonly ContentToken[];
};

type EducationalExplanation = {
  summary: readonly ContentToken[];
  formal?: FormalReasoningContent;
  concepts?: readonly ("candidate-key" | "primary-key" |
    "prime-attribute" | "minimal-cover")[];
};
```

`closure` representa únicamente la expresión visual `X⁺`; no contiene ni
calcula el resultado de un cierre. El union de conceptos se ampliará por
tranche, cuando exista un consumidor real.

`summary` es el único campo obligatorio. `formal` existe cuando hay una regla
aplicada a evidencia contextual. `concepts` sólo referencia definiciones
canónicas; no copia sus textos. No hay `title`, `id`, `open`, `severity` ni
layout en el contenido: pertenecen al componente y al estado UI.

## Provenance model

`source` describe qué autoriza una afirmación:

- `dto`: campo o semántica discriminada del response; por ejemplo, un item de
  `third.violations` ya significa non-trivial, determinant non-superkey y
  dependent non-prime;
- `snapshot`: lookup, cardinalidad, pertenencia, proper subset o cobertura entre
  sets de IDs asociados a la misma operación;
- `operation-contract`: garantía documentada del algoritmo público, como
  lossless join de la síntesis/decomposición.

Provenance se usa para revisión y tests. Sólo se muestra como etiqueta visible
en resultados de transformaciones, donde distinguir `Guaranteed by algorithm`
de `Observed / checked` cambia la interpretación. No se llena la UI de badges de
procedencia.

No existe `computed` como source. Si un builder necesitara calcular closure,
keys, minimal cover, proyecciones o normal forms, la feature se rechaza o se
solicita evidencia al backend en una tranche futura.

## Content tokens and notation

Los tokens evitan interpolar matemática en strings opacas. El renderer puede:

- resolver IDs con el snapshot inmutable;
- ordenar conjuntos para presentación según la relación;
- renderizar `<code>` sólo para matemática;
- crear un accessible name como `B functionally determines C` aunque muestre
  `B → C`;
- degradar un ID desconocido de manera uniforme;
- probar que una conclusión usa exactamente la evidencia recibida.

`text` no debe contener notación que tenga un token propio. No se admite HTML en
strings ni markdown en runtime.

## Builders by mathematical result

No habrá un builder genérico con docenas de campos opcionales. Funciones puras
por contrato preservan el tipo de evidencia:

```text
buildCandidateKeyExplanation(key, analysis, snapshot)
buildPrimeAttributeExplanation(attributeId, analysis, snapshot)
buildMinimalCoverExplanation(analysis.minimalCover)
buildSecondNormalFormExplanation(violation, snapshot)
buildThirdNormalFormExplanation(violation, analysis, snapshot)
buildBcnfExplanation(violation, analysis, snapshot)
buildClosureExplanation(selected, response, inputSnapshot)
buildSynthesisExplanation(response, snapshot)
buildBcnfStepExplanation(step, snapshot)
buildPreservationExplanation(response, snapshot)
```

Los parámetros incluyen sólo el DTO y snapshot necesarios. Los builders no
reciben las FDs originales salvo para presentarlas; esto hace más difícil que
una implementación accidental intente analizarlas.

## Builder contracts

### Candidate key

- Input: key ya incluida en `candidateKeys`.
- Claims permitidos: superkey, minimal por inclusión, compuesta/vacía por
  cardinalidad.
- Claims prohibidos: primary key; cierre enumerado; qué subset se probó.

### Prime attribute

- Input: attribute ya incluido en `primeAttributes` y candidate keys.
- Derivación permitida: keys que contienen el ID.
- Invariante defensiva: si ninguna key lo contiene, producir contract-error
  presentation; no fabricar una explicación.

### Minimal Cover

- Input: cover retornado.
- Claims permitidos: singleton RHS, no LHS extraneous, no FD redundant,
  equivalencia con F como propiedades contractuales.
- Claims prohibidos: orden de ejecución, antes/después por FD, razón concreta de
  eliminación.

### 2NF violation

- Input: `candidateKey`, `determinant`, `dependent` del DTO.
- Evidence: candidate key, proper subset, dependent non-prime, partial
  dependency.
- Invariante defensiva: determinant debe ser proper subset y dependent no debe
  pertenecer a la key. Una anomalía no se corrige localmente; se reporta como
  contract error.

### 3NF violation

- Input: determinant/dependent y prime attributes.
- Evidence: FD non-trivial, determinant no-superkey, dependent non-prime.
- La no-trivialidad y no-superkey proceden del tipo de colección, no de Closure.
- Conclusion: ninguna alternativa de 3NF se cumple.

### BCNF violation

- Input: determinant/dependent y, para copy contextual, prime attributes.
- Evidence: FD non-trivial y determinant no-superkey.
- El estado `3NF satisfied` habilita explicar la excepción prime usando
  membership; no cambia la regla BCNF.

### Closure

- Input: selected attributes, response y exactamente su input snapshot.
- Derivación permitida: el closure contiene todos los attribute IDs del snapshot.
- No compara con draft actual ni aplica FDs.

### Transformations

- Synthesis: relations/source/minimalCover/addedCandidateKey son DTO facts;
  3NF, preservation y lossless son operation-contract facts.
- BCNF: source/violation/result/leaves son DTO facts; BCNF leaves y lossless son
  operation-contract facts.
- Preservation: status y lost/preserved dependencies son DTO facts del checker,
  visibles como observed/checked.

## Glossary model

Las definiciones son contenido estático separado de explicaciones:

```ts
type GlossaryEntry = {
  id: ConceptId;
  term: string;
  shortDefinition: readonly ContentToken[];
  formalDefinition?: readonly ContentToken[];
  related?: readonly ConceptId[];
  caution?: readonly ContentToken[];
};
```

`caution` sostiene contrastes que previenen errores frecuentes, por ejemplo
prime vs primary, 1NF assumed vs checked y preservation vs data loss. Un entry
no contiene estado abierto ni decide popover/disclosure.

Las definiciones canónicas están inventariadas en
`educational-ux-v1.1.md#16-estrategia-de-glossary-y-ayuda-conceptual`.

## Result and guarantee language

Se reserva vocabulario estable:

| Categoría | Label | Ejemplo |
| --- | --- | --- |
| Resultado del response | `Result` o sin label | `3NF — Violated` |
| Evidencia contextual | `Why?` / `Evidence` | `B → C` |
| Garantía del algoritmo | `Guaranteed by algorithm` | `Lossless join` |
| Checker ejecutado | `Observed / checked` | `Not preserved` |
| Checker aún no ejecutado | `Not checked` | `Dependency preservation` |
| Precondición externa | `Assumed, not calculated` | `1NF` |

`Guaranteed` nunca se cambia a `verified`. `Not preserved` nunca se llama
`lossy`, y `lossless` nunca se usa como sinónimo de preservation.

## Satisfied-state explanations

Un `satisfied: true` permite resumir que no se identificó una violación según la
regla. No habilita enumerar todos los determinantes o closures examinados. Los
builders usan formulaciones contractuales:

- 2NF: no partial dependency de non-prime sobre proper subset identificada;
- 3NF: toda dependencia no trivial considerada satisface superkey OR prime;
- BCNF: todo determinant no trivial considerado es superkey.

No se produce un array de evidencia vacío presentado como prueba exhaustiva.

## Defensive behavior

El frontend confía en el contrato para copy, pero no debe romper si una response
es inconsistente:

- ID desconocido: mostrar `Unknown attribute` con ID sólo en detalle técnico y
  registrar contract error;
- 2NF determinant no proper-subset: omitir conclusión y mostrar error de
  evidencia, no corregirla;
- prime attribute sin candidate key de origen: omitir `because` específico;
- `preserved: true` con lost dependencies: priorizar error contractual, no dos
  estados contradictorios;
- source de transformación desconocido: exhaustiveness check en TypeScript.

Estas validaciones son guardrails de presentación, no análisis matemático.

## State boundary

El modelo es inmutable y se construye al render o se memoiza por identidad de
response/snapshot. No se guarda en Project. Los únicos estados interactivos son
qué disclosures están abiertos y qué concepto está activo. No hay analytics,
history, preference persistence ni educational progress en v1.1.

## Testing contract

- cada builder se prueba con el DTO mínimo que autoriza su claim;
- cada `ContentToken` produce notación visual y accessible name equivalente;
- provenance forma parte de assertions, aunque no siempre sea visible;
- tests negativos buscan palabras prohibidas: `primary key` como resultado,
  `the algorithm removed` sin trace, `transitive` como criterio 2NF,
  `data loss` como equivalencia de non-preservation;
- fixtures de `∅`, múltiples keys y 3NF-but-not-BCNF son obligatorios;
- ningún test de builder importa el normalization engine ni llama al API.

## Future extension rule

Antes de añadir un nuevo claim se registra en el data sufficiency audit. Si no
es A o B, no se aproxima con lógica frontend. Una trace futura tendría su propio
DTO discriminado y renderer; no se reconstruiría comparando input/output.
