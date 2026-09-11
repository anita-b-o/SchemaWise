# SchemaWise Educational UX v1.1

Status: diseño aprobado. Tranche 1 implementada para Candidate Keys, Prime
Attributes, Minimal Cover y primitivas de notación. Tranche 2 implementada para
jerarquía y reasoning educativo de 2NF, 3NF y BCNF. Tranche 3 implementada para
Attribute Closure, cobertura de la relación y relación conceptual con
superkeys/candidate keys. Tranche 4 implementada para provenance de 3NF
Synthesis y BCNF Decomposition y reasoning de Dependency Preservation. La
tranche 5 permanece pendiente. No se
modifican contratos ni algoritmos.

## 1. Objetivo educativo

SchemaWise v1.1 conserva la rapidez de una calculadora de normalización y añade
una capa explicativa determinística. Después de analizar una relación, una
persona debe poder distinguir el resultado, la evidencia que lo sostiene y la
regla formal aplicada sin abandonar el contexto de su propio schema.

La experiencia no intenta enseñar todo normalización ni reemplazar un curso. Se
concentra en responder tres preguntas en orden:

1. ¿Cuál es el resultado?
2. ¿Por qué se obtuvo para este schema?
3. ¿Qué regla y conceptos permiten interpretarlo?

Toda afirmación contextual proviene de un DTO del engine, de una comparación de
conjuntos trivial contra el snapshot inmutable o de una garantía documentada de
la operación. La UI no descubre keys, no calcula covers, no reanaliza formas
normales y no inventa trazas.

## 2. Principios de experiencia

- **Resultado primero.** El resumen inicial continúa siendo compacto y apto
  para quien sólo necesita comprobar su trabajo.
- **El schema del usuario es el ejemplo principal.** La ayuda general usa un
  ejemplo artificial sólo si no existe evidencia contextual adecuada.
- **Una afirmación, una procedencia.** Resultado, evidencia observada y garantía
  algorítmica usan etiquetas y copy diferentes.
- **La notación acompaña al lenguaje.** Nunca se exige interpretar un símbolo
  Unicode sin un nombre accesible o una explicación cercana.
- **Profundidad voluntaria.** La explicación formal permanece cerrada hasta que
  la persona la solicita.
- **Sin falsa causalidad.** Un resultado final no se presenta como una secuencia
  exacta de pasos si el API no expone esa secuencia.
- **El estado educativo no es schema state.** Abrir una definición o elegir una
  evidencia no ensucia ni persiste el proyecto.

## 3. Arquitectura de información

El orden del resultado será:

1. encabezado del análisis y vigencia del snapshot;
2. candidate keys y prime attributes;
3. jerarquía compacta de formas normales;
4. Minimal Cover;
5. explicaciones de violaciones, asociadas desde cada forma normal;
6. transformaciones solicitadas por el usuario;
7. comprobación separada de dependency preservation;
8. ayuda conceptual contextual.

Los términos se explican donde se usan. Un índice de conceptos secundario
permite volver a consultarlos, pero no se antepone a los resultados.

### Wireframe: analysis overview

```text
ANALYSIS
R(A, B, C)                                      Current

Candidate keys                Prime attributes
{A}                           {A}
[Why is this a key?]          [Why prime?]

NORMAL FORMS
1NF*  Assumed, not calculated
  ↓
2NF   Satisfied
  ↓
3NF   Violated · 1 violation                 [Why?]
  ↓
BCNF  Violated · 1 violation                 [Why?]

* SchemaWise cannot determine 1NF from functional dependencies.

MINIMAL COVER
A → B
B → C                                        [What is this?]
```

`Why?` nombra una acción y no un icono huérfano. En desktop puede aparecer en
la fila; en mobile ocupa la siguiente línea.

## 4. Progressive disclosure

### Level 1 — Result

Visible siempre. Incluye el nombre del objeto, estado, cantidad y evidencia
matemática mínima:

```text
3NF    Violated    1 violation
```

Las candidate keys, prime attributes, cover y relaciones resultantes también
son Level 1 porque son resultados, no material de ayuda.

### Level 2 — Why?

Se abre explícitamente junto al resultado. Contiene una explicación contextual
de una o dos frases y la FD o key relevante:

```text
B → C violates 3NF because {B} is not a superkey and C is not prime.
```

Para varias violaciones, el disclosure abre una lista; cada ítem tiene un
resumen corto propio. Level 2 no abre otros disclosures automáticamente.

### Level 3 — Learn / formal reasoning

Un segundo disclosure dentro del ítem, `Learn the rule`, contiene:

- regla formal;
- hechos de evidencia ya disponibles;
- conclusión;
- enlaces de texto a conceptos relacionados;
- explicación de símbolos cuando aparezcan por primera vez.

Permanece cerrado por defecto incluso después de abrir Level 2. No se usa un
modo tutorial global ni onboarding obligatorio.

### Comportamiento de vigencia

Las explicaciones pertenecen al mismo snapshot que el resultado. Si el draft
cambia, permanecen visibles con el aviso `Out of date`; no mezclan atributos
del draft nuevo. Un resultado stale nunca dispara Analyze ni una transformación.

## 5. Candidate keys

Level 1 muestra cada key como conjunto independiente. El singular/plural se
adapta y nunca se marca una como `primary`:

```text
Candidate keys
{A, B}   {A, C}
```

Level 2 para cada key dice:

> `{A, B}` is a candidate key: it determines every attribute in `R`, and no
> proper subset of it does.

Level 3 separa las nociones:

- **superkey:** determina todos los atributos, pero puede contener atributos
  innecesarios;
- **candidate key:** superkey mínima por inclusión;
- **primary key:** candidate key elegida en un diseño de base de datos;
- SchemaWise descubre candidate keys, pero no elige una primary key.

Una key con más de un atributo se etiqueta en prosa como `composite candidate
key`; no recibe un estado distinto. Con varias keys, se añade: `A relation can
have more than one candidate key; choosing a primary key is a later design
decision.`

La pertenencia del resultado a `candidateKeys` permite afirmar que determina
la relación y es mínima, porque ése es el contrato del resultado. El análisis
no permite mostrar honestamente una expansión concreta como `{A}+ = {A,B,C}`.
Sólo se muestra si la misma key ya tiene un resultado de Closure vigente para el
mismo snapshot; nunca se ejecutan requests automáticos por cada key.

Para la candidate key vacía se muestra:

```text
∅  Empty-set candidate key
The functional dependencies determine every attribute without starting
attributes. The empty set has no proper subsets, so it is minimal.
```

No se la describe como ausencia de key.

### Wireframe: candidate key explanation

```text
Candidate keys
{A, B}                                      [Why is this a key?]
  Determines: every attribute in R
  Minimal: no proper subset is a superkey
  [Learn candidate key vs superkey vs primary key]
```

## 6. Prime attributes

Level 1 muestra el conjunto de prime attributes. Level 2 usa `candidateKeys`
para indicar procedencia mediante pertenencia, sin cálculo:

```text
A is prime because it belongs to candidate key {A, B}.
C is prime because it belongs to candidate key {A, C}.
```

Si un atributo pertenece a varias keys se listan todas, en el orden del DTO. La
frase de contraste es permanente en Level 3: `Prime does not mean “part of the
primary key.” A prime attribute belongs to at least one candidate key; no
primary key has been selected here.`

Cuando la única candidate key es `∅`, `primeAttributes` es `∅`. La UI explica
que ninguna key contiene atributos; no lo presenta como error.

## 7. Minimal Cover

Level 1 conserva el cover como lista de FDs. Level 2 lo define como un conjunto
equivalente y reducido de dependencias. Level 3 se titula `Properties of this
minimal cover`, no `How SchemaWise reduced your FDs`, y enumera:

- cada RHS contiene un único atributo;
- ningún atributo de un LHS es extraneous;
- ninguna FD completa es redundante;
- el cover implica exactamente las mismas FDs que el conjunto original.

Copy recomendado:

> These are properties of the returned minimal cover. The API returns the
> result, not an execution trace, so this view does not claim which dependency
> was changed or removed at each algorithm step.

Si el resultado es `∅`, se explica que no quedan restricciones no triviales en
el cover. No se afirma que el usuario no haya ingresado FDs: FDs triviales o con
RHS vacío pueden desaparecer. Comparar visualmente F original y el cover es una
presentación permitida, pero etiquetar una FD específica como `redundant` o un
atributo como `extraneous` requeriría traza y queda fuera de v1.1.

## 8. 2NF

Regla formal mostrada en Level 3:

> Under the 1NF assumption, a relation is in 2NF when no non-prime attribute is
> functionally dependent on a proper subset of a candidate key.

Cada `SecondNormalFormViolationDto` produce esta cadena exacta:

1. `{A, B}` es una candidate key.
2. `{A}` es un subconjunto propio de `{A, B}`.
3. `C` es non-prime.
4. `{A} → C` expresa que `C` depende de parte de esa candidate key.
5. Ésta es una partial dependency; por eso viola 2NF.

### Wireframe: violation explanation expanded

```text
2NF   Violated · 1 violation
[-] Why?

Partial dependency                         A → C
{A} is a proper subset of candidate key {A, B}, and C is non-prime.
Therefore C depends on part of a candidate key.

[+] Learn the 2NF rule
```

Cuando 2NF está satisfecha:

> No partial dependency of a non-prime attribute on a proper subset of a
> candidate key was identified.

No se usa `transitive dependency` como prueba positiva o negativa de 2NF.

## 9. 3NF

Regla formal:

> For every non-trivial functional dependency `X → A`, `X` is a superkey or
> `A` is a prime attribute.

Cada evidencia de violación se explica sin ejecutar Closure:

1. `X → A` es no trivial (`A` no pertenece a `X`), hecho garantizado por estar
   en la colección de violaciones;
2. `X` no es superkey, también garantizado por el tipo de resultado;
3. `A` no es prime; se puede corroborar por pertenencia en `primeAttributes`;
4. no se cumple ninguna de las dos excepciones permitidas por 3NF;
5. por eso la FD viola 3NF.

Cuando 2NF está satisfecha pero 3NF no, aparece una nota contextual:

> There is no contradiction. 2NF rules out partial dependencies on part of a
> candidate key. 3NF additionally tests every non-trivial dependency against
> the superkey-or-prime rule.

La UI no necesita etiquetar la evidencia como `transitive dependency`. Puede
explicar ese concepto desde el glosario, pero el criterio mostrado sigue siendo
la regla formal.

Cuando está satisfecha, el copy es: `Every non-trivial dependency considered by
the analysis meets at least one 3NF condition: superkey determinant or prime
dependent.` No se enumera una prueba inexistente.

## 10. BCNF

Regla formal:

> For every non-trivial functional dependency `X → A`, `X` must be a superkey.

Cada violación muestra la FD y: `X is not a superkey, so this non-trivial
dependency violates BCNF.` Level 3 compara reglas sin ambigüedad: BCNF elimina
la excepción de 3NF que permite un dependent prime.

Si 3NF está satisfecha y BCNF no, la explicación usa el resultado real:

> This relation satisfies 3NF because `A` is prime, but it violates BCNF
> because `X` is not a superkey. BCNF does not allow the prime-attribute
> exception.

`X` y `A` se sustituyen con cada evidencia real; no se introduce otro schema.
Si no existe ese estado, la diferencia se explica sólo en la ayuda general.

Cuando BCNF está satisfecha: `Every non-trivial determinant considered by the
analysis is a superkey.`

## 11. Jerarquía de formas normales

No se usa un stepper: no hay pasos por completar ni navegación de wizard. Es
una cadena semántica compacta con filas de estado:

```text
1NF*  Assumed, not calculated
  → increasingly strict
2NF   Satisfied
  → increasingly strict
3NF   Satisfied
  → increasingly strict
BCNF  Violated · 1 violation

* 1NF is an external precondition. SchemaWise does not calculate it.
Logical implication runs in the reverse direction: BCNF ⇒ 3NF ⇒ 2NF.
```

El orden visual ascendente permite leer `BCNF ⇒ 3NF ⇒ 2NF`; una frase accesible
lo hace explícito: `BCNF implies 3NF, and 3NF implies 2NF.` Nunca se dibuja un
check para 1NF. El asterisco, el texto `Assumed, not calculated` y la nota son
redundantes a propósito.

### Wireframe: normal form hierarchy

```text
NORMAL FORMS                       BCNF implies 3NF implies 2NF
1NF*  Assumed, not calculated
2NF   ✓ Satisfied
3NF   ✓ Satisfied
BCNF  × Violated · 1              [Why?]
```

## 12. Attribute Closure (Tranche 3 implementada)

La explicación se muestra sólo después de calcular, para mantener la herramienta
secundaria compacta. Define:

> `X+` (the closure of X) is the set of attributes functionally determined by
> X under the current functional dependencies F.

Explica que Closure permite comprobar la condición de superkey y fundamenta la
búsqueda de candidate keys, sin afirmar minimalidad. Después de una respuesta:

```text
Selected set                    Closure
{A}                             {A, B, C}

A⁺ = {A, B, C}
Determines every attribute in R: Yes
```

El último estado se deriva comparando, como conjuntos de IDs, `closure` con los
atributos del `inputSnapshot`. Esta comparación es segura: no calcula el cierre
ni intenta reproducir `isSuperkey`; sólo aplica la definición al resultado ya
calculado. Debe comprobar igualdad de cobertura, no orden o display names.

La selección, cierre y conclusión usan siempre el snapshot capturado. Si queda
stale, el bloque completo muestra `Out of date`; la conclusión no se recomputa
contra el draft actual. Closure sigue siendo una acción explícita y no depende
de Analyze.

### Wireframe: closure educational state

```text
ATTRIBUTE CLOSURE
X⁺ is everything determined by X under F.       [Learn uses]

Starting attributes  [A] [B] [C]
[Calculate closure]

Selected set   {A}
Closure        {A, B, C}
Superkey test  Yes — the closure contains every attribute in R.
```

Para ninguna selección se usa `∅⁺`, con nombre accesible `closure of the empty
set`. Si el cierre también es vacío, ambos valores se conservan: `∅⁺ = ∅`.

La implementación usa dos disclosures hermanos: `What does this mean?` para
definición, atributos determinados/faltantes y conclusión Yes/No; y `Formal
reasoning`, cerrado por defecto, para regla, evidencia y conclusión. No presenta
una secuencia de FDs ni una traza algorítmica. La ecuación completa tiene una
única lectura accesible, por ejemplo `closure of A equals set containing A, B
and C`.

## 13. 3NF Synthesis (Tranche 4 implementada)

La presentación separa resultado y garantías:

```text
3NF SYNTHESIS

CREATED RELATIONS
S1 {A, B}    From minimal cover
S2 {B, C}    From minimal cover

ADDED FOR A CANDIDATE KEY
None

GUARANTEED BY 3NF SYNTHESIS
3NF relations · Dependency preserving · Lossless join

[Show minimal cover used] [Learn what the synthesis did]
```

`relations[].source` sostiene el origen de cada relación. Cuando
`addedCandidateKey` no es `null`, se muestra la key exacta y: `No relation
derived from the minimal cover contained a complete candidate key, so the
algorithm added this relation.` Cuando es `null`, se dice `No additional
candidate-key relation was needed`; no se intenta inferir cuál relación ya
contiene una key.

La garantía de la operación se etiqueta `Guaranteed by algorithm`, no
`Checked`. El DTO no contiene verificadores independientes de 3NF, preservation
o lossless join. `Minimal cover used` es evidencia observada del response; no es
una traza de cómo se construyó.

### Wireframe: synthesis explanation

```text
S1 {A, B}       Source: minimal cover
  Supports local enforcement of A → B
S2 {B, C}       Source: minimal cover

Guaranteed by algorithm
✓ Relations are in 3NF
✓ Dependency preserving
✓ Lossless join
[Learn these guarantees]
```

La frase `Supports local enforcement of A → B` sólo se usa cuando la asociación
es directa y no ambigua. Como el DTO agrupa relaciones pero no relaciona cada
FD con una relación, v1.1 omite esa línea y lista por separado el cover usado.

## 14. BCNF Decomposition (Tranche 4 implementada)

Las relaciones finales son Level 1. Los pasos existentes forman un disclosure
Level 2; cada paso conserva el orden del API:

```text
Step 1
Source       R(A, B, C)
Violation    C → B
Why split?   {C} is not a superkey of the source relation.
Result       S1 {B, C}
             S2 {A, C}
```

La explicación `not a superkey` procede de que la FD es una
`BcnfViolationDto` del step. No se calcula Closure en frontend. Level 3 explica
que la división guiada por esa FD produce un paso lossless; no expone chase.

### Wireframe: BCNF step explanation

```text
[-] DECOMPOSITION STEPS
1  Source       R(A, B, C)
   Split on     C → B
   Reason       C is not a superkey in this source.
   Children     {B, C}
                {A, C}
   [Learn why this split is lossless]
```

La banda de propiedades dice:

- `Guaranteed by BCNF decomposition: final relations satisfy BCNF; lossless
  join.`
- `Not guaranteed: dependency preservation.`
- antes del checker: `Not checked yet`;
- después del checker: `Observed / checked result: Preserved` o `Not preserved`.

## 15. Dependency preservation (Tranche 4 implementada)

Se mantiene como propiedad independiente de BCNF y de lossless join.

Copy para `Preserved`:

> The dependencies represented by the original minimal cover can be enforced
> through dependencies on the decomposed relations, without reconstructing the
> original relation.

Copy para `Not preserved`:

> At least one dependency represented by the original minimal cover cannot be
> enforced through the local projected dependencies alone.

`lostDependencies` es la evidencia primaria visible. `preservedDependencies`
permanece en un disclosure secundario. Se aclara: `Not preserved does not mean
data was lost. It describes where constraints can be checked.`

Lossless join se define separadamente como la garantía de reconstruir la
relación original mediante join sin introducir tuplas espurias. Se evita la
frase ambigua `without losing information` como única definición.

## 16. Estrategia de glossary y ayuda conceptual

Se adopta un sistema híbrido:

- **definición inline breve** la primera vez que un concepto es esencial para
  interpretar el resultado;
- **popover no modal** para definiciones breves opcionales en desktop, abierto
  por botón con texto o término subrayado y también usable por teclado;
- **disclosure inline** en mobile y para reglas/evidencia esenciales;
- **glossary panel en flujo**, al final de Analysis, como índice reusable. No es
  drawer obligatorio ni ruta nueva.

No se coloca `?` junto a cada término. Los puntos de entrada son `Learn the
rule`, `What is a candidate key?`, `What does lossless mean?` y enlaces de texto
dentro de explicaciones.

El glosario v1.1 cubre:

| Concepto | Definición corta canónica |
| --- | --- |
| Functional dependency | `X → Y` means equal X values require equal Y values. |
| Determinant | The attribute set on the left side of a functional dependency. |
| Attribute closure | All attributes determined by a starting set under F. |
| Superkey | An attribute set whose closure contains every attribute in R. |
| Candidate key | A superkey minimal by inclusion. |
| Primary key | The candidate key selected for identification in a database design; SchemaWise does not select it. |
| Prime attribute | An attribute belonging to at least one candidate key. |
| Partial dependency | A non-prime attribute depends on a proper subset of a candidate key. |
| Transitive dependency | A dependency reached through other dependencies; it is not itself the formal 2NF or 3NF test. |
| Minimal cover | An equivalent FD set with singleton RHSs, no extraneous LHS attributes and no redundant FDs. |
| 1NF | A condition about atomic relation values; assumed, not calculated here. |
| 2NF | 1NF plus no partial dependency of a non-prime attribute on a candidate key. |
| 3NF | For every non-trivial `X → A`, X is a superkey or A is prime. |
| BCNF | For every non-trivial `X → A`, X is a superkey. |
| Lossless join | Joining the decomposed projections reconstructs exactly the valid original relation, without spurious tuples. |
| Dependency preservation | Original constraints can be enforced through local projected dependencies without joining the decomposition. |

## 17. Notación

| Visual | Lectura accesible | Uso |
| --- | --- | --- |
| `∅` | empty set | conjunto sin atributos |
| `X⁺` | closure of X | atributos determinados por X bajo F |
| `X → Y` | X functionally determines Y | functional dependency |
| `{A, B}` | set containing A and B | conjunto de atributos |
| `R(A, B, C)` | relation R with attributes A, B and C | schema de relación |

Relation, set, closure y FD usan `<code>` con fuente monospace. Nombres de
conceptos, estados, conteos y explicaciones usan la tipografía UI. Las llaves no
se omiten en conjuntos dentro de prosa formal; una FD puede mostrar conjuntos
sin llaves sólo conforme a la convención compacta, nunca si vuelve ambiguo un
nombre multicaracter.

Los componentes de notación generan un nombre accesible completo. El glifo
flecha y el superscript plus pueden estar ocultos al árbol accesible si el
equivalente textual es el accessible name. No se depende de `title`, color o
pronunciación del lector de pantalla.

## 18. Accessibility

Contrato WCAG 2.2 AA:

- disclosures con `<details>/<summary>` cuando la semántica nativa encaje, o
  botón con `aria-expanded` y `aria-controls` si se necesita control adicional;
- el summary empieza con texto descriptivo, no sólo icono;
- abrir Level 2/3 no mueve el foco; el contenido queda inmediatamente después
  del control en DOM;
- cerrar una superficie con gestión propia devuelve foco a su activador;
- encabezados reflejan `Analysis > sección > evidencia`, sin saltos usados sólo
  por estilo;
- `aria-describedby` conecta estados con su nota 1NF, una fórmula con su lectura
  textual y controles disabled con su razón;
- todas las acciones operan con Tab, Shift+Tab, Enter y Space según semántica
  nativa; Escape sólo cierra popovers, no disclosures inline;
- tooltip hover-only queda prohibido para definiciones esenciales;
- estados incluyen palabra e icono; color nunca es la única señal;
- anuncios live se reservan para finalización/error de requests y cambios
  asíncronos de resultado. Abrir ayuda, cambiar selección educativa o expandir
  detalles no se anuncia por live region;
- al completar Analyze no se fuerza foco al resultado; el mensaje polite
  anuncia disponibilidad. Errores de validación sí siguen la política existente;
- targets táctiles y focus indicators cumplen los mínimos definidos en v1.

## 19. Mobile 320–390 px

La jerarquía mantiene un solo DOM. Level 2 y 3 se expanden verticalmente bajo su
resultado. No hay tablas para evidencias, panel lateral ni popover esencial. Los
pares `label/value` pasan a `dl` apilado; notaciones largas usan wrap entre
atributos o scroll local como último recurso, nunca scroll horizontal de página.

### Wireframe: mobile

```text
+----------------------------+
| ANALYSIS                   |
| R(A, B, C)        Current |
|                            |
| Candidate key             |
| {A}       [Why this key?] |
|                            |
| NORMAL FORMS               |
| 1NF* Assumed              |
| 2NF  Satisfied            |
| 3NF  Violated · 1         |
| [Why?                    ] |
|   B → C                   |
|   B is not a superkey.    |
|   C is not prime.         |
|   [Learn the 3NF rule   ] |
| BCNF Violated · 1         |
|                            |
| MINIMAL COVER              |
| A → B                     |
| B → C                     |
+----------------------------+
```

Las relaciones de una transformación se apilan. Un BCNF split usa Source,
Violation y Child 1/2, no diagrama horizontal. A 320 px, los botones educativos
pueden ocupar todo el ancho y la notación conserva tamaño legible.

## 20. State model

El estado educativo queda local a la vista que lo usa:

```text
AnalysisResults
├─ openWhy: normal-form id | null (local; multiple may also be acceptable)
├─ openFormalReasoning: set of evidence ids (local)
├─ glossaryOpen / activeConcept (local to concept help)
└─ selectedEvidence (only if a list requires it; local)
```

Se prefieren disclosures nativos no controlados cuando no haya coordinación. Un
estado React sólo se añade para focus return, exclusión mutua útil o enlace
conceptual entre activador y glossary.

Este estado:

- no entra en `SchemaDraft`, Project, dirty comparison o payloads;
- no cambia `revision`, `serverRevision` ni `sourceRevision`;
- no dispara Analyze, Closure ni transformaciones;
- se puede perder al recargar sin perjuicio;
- no se guarda en localStorage ni preferencias en v1.1.

El contenido siempre recibe `result` y `analyzedSnapshot` juntos. Ningún builder
educativo consulta el draft mutable.

## 21. Component model

Se extienden responsabilidades existentes:

- `AnalysisResults`: orden, snapshot y sección `Concept help`.
- `NormalFormSummary`: jerarquía 1NF*/2NF/3NF/BCNF, Level 1 y entrada a Why.
- `ViolationDetails`: Level 2 por forma y Level 3 por evidencia; deja de renderizar
  frases genéricas sin regla estructurada.
- `SynthesisResult`: separa created relations, observed source y algorithm
  guarantees.
- `BcnfResult`: convierte steps en explicaciones Source/Violation/Reason/Split y
  separa garantías del checker.
- `DependencyPreservationResult`: lost dependencies primero y aclaración
  `not data loss`.
- `ClosureTool`: definición, Selected/Closure/Superkey test y vigencia común.
- `explanation-builders.ts`: builders puros, tipados por resultado; no contiene
  algoritmos.
- `schema-formatters.ts`: sólo canonicalización visual y nombres accesibles.

Componentes nuevos justificados semánticamente:

- `CandidateKeyExplanation`: una key, minimalidad y contraste terminológico;
- `PrimeAttributeOrigins`: mapea pertenencia de attributes a candidate keys;
- `FormalReasoning`: regla, evidencia y conclusión dentro de un disclosure;
- `ConceptHelp`: índice y superficie responsive del glosario;
- `MathNotation`: primitivas `AttributeSetNotation`, `FunctionalDependencyNotation`,
  `ClosureNotation` y `RelationNotation` con accessible names;
- `PropertyProvenance`: etiqueta consistente `Guaranteed by algorithm`,
  `Observed / checked` o `Not checked`.

No se crean `EducationalCard`, `EducationalSection`, `EducationalContainer` ni
wrappers de layout. `MinimalCover` puede extraerse del markup actual sólo si su
explicación y estado vacío justifican una responsabilidad propia.

## 22. Data sufficiency audit

Clasificación:

- **A:** exclusivamente DTO/contrato actual;
- **B:** derivación trivial de IDs contra el snapshot;
- **C:** requeriría un dato nuevo del backend en el contexto de ese resultado;
- **D:** no implementar porque duplicaría/recomputaría lógica matemática.

| Feature / claim | Clase | Evidencia y decisión v1.1 |
| --- | --- | --- |
| Listar candidate keys | A | `AnalysisResponseDto.candidateKeys`. |
| Afirmar `minimal superkey` | A | Semántica contractual de pertenecer a `candidateKeys`. |
| Mostrar el cierre exacto de cada candidate key dentro de Analysis | C | Requeriría añadirlo al resultado de Analysis; alternativamente, sólo reutilizar como A un Closure vigente que el usuario haya solicitado para esa key y snapshot. |
| Probar minimalidad eliminando cada atributo | D | Exigiría cierres/recomputación o nueva evidencia backend; no implementar. |
| Distinguir candidate/super/primary key | A | Definiciones estáticas; no se selecciona primary key. |
| Detectar key compuesta o vacía | B | Cardinalidad del set retornado. |
| Listar prime attributes | A | `primeAttributes`. |
| Mostrar de qué keys surge cada prime attribute | B | Membership trivial en `candidateKeys`. |
| Mostrar Minimal Cover | A | `minimalCover`. |
| Afirmar las cuatro propiedades del cover | A | Contrato del resultado. |
| Mostrar pasos exactos del algoritmo de cover | C | Requeriría trace nueva; no implementar en v1.1. |
| Marcar qué input FD era redundante/extraneous | D | No se puede inferir con comparación textual segura. |
| Explicar una violación 2NF | A/B | DTO trae key/determinant/dependent; proper-subset y non-prime son hechos contractuales, corroborables por sets. |
| Explicar 2NF satisfied | A | `satisfied`; copy no inventa lista de pruebas. |
| Explicar una violación 3NF/BCNF | A/B | Tipo de colección garantiza non-trivial/non-superkey; prime membership es trivial. |
| Explicar 2NF sí / 3NF no | A | Estados concurrentes y reglas estáticas. |
| Explicar 3NF sí / BCNF no con datos reales | A/B | Estados y `bcnf.violations`; dependent prime se corrobora por membership. |
| Jerarquía y conteos | A | `normalForms`; 1NF es precondición estática, no resultado. |
| Closure Selected y Closure | A | Estado de request existente + `ClosureResponseDto`. |
| `Determines all attributes: Yes/No` | B | Cobertura por igualdad de sets contra `inputSnapshot.relation.attributes`. |
| Mostrar pasos de propagación del cierre | C | Response no trae trace; no implementar. |
| Relaciones/source de síntesis | A | `relations[].attributes/source`. |
| Candidate-key relation añadida | A | `addedCandidateKey`. |
| Asociar cada relación de síntesis con FDs exactas | C | DTO no ofrece relación FD→schema; no inferir. |
| Garantías de síntesis | A | Contrato documentado de la operación; etiquetar como guarantee, no checked result. |
| Hojas y steps BCNF | A | `relations` y `steps`. |
| Explicar determinant no-superkey del step | A | Semántica de `step.violation`. |
| Mostrar un chase o prueba general lossless | D | Fuera de scope y sin DTO. |
| Garantías BCNF/lossless | A | Contrato documentado de la operación. |
| Resultado y lost dependencies | A | `DependencyPreservationResponseDto`. |
| Mostrar proyecciones locales usadas por checker | C | No están en response; no inferir. |
| Glosario y notación | A | Contenido estático versionado y contextual. |

No se propone ningún cambio de API en esta tranche.

## 23. Example scenarios

### Case A — 2NF sí, 3NF no

```text
R(A, B, C)
F = { A → B, B → C }
Candidate keys: {A}
Prime attributes: {A}
2NF: satisfied
3NF: violated by B → C
BCNF: violated by B → C
```

El Level 2 de 3NF dice que B no es superkey y C no es prime. La nota contextual
explica que 2NF sólo busca dependencias parciales de una key; `{A}` no tiene un
subconjunto propio que produzca esta violación.

### Case B — 3NF sí, BCNF no

```text
R(A, B, C)
F = { AB → C, C → B }
Candidate keys: {A, B}, {A, C}
Prime attributes: {A, B, C}
3NF: satisfied
BCNF: violated by C → B
```

La explicación usa el caso real: B es prime, por lo que la excepción de 3NF se
cumple; C no es superkey, por lo que BCNF falla.

### Case C — violación 2NF con key compuesta

```text
R(A, B, C)
F = { AB → C, A → C }
Candidate key: {A, B}
Prime attributes: {A, B}
2NF: violated by candidateKey={A,B}, determinant={A}, dependent=C
```

La UI verbaliza proper subset, non-prime y partial dependency en ese orden. No
la llama transitive dependency.

### Case D — múltiples keys y orígenes prime

```text
R(A, B, C, D)
F = { A → B, B → A, C → D, D → C }
Candidate keys: {A,C}, {A,D}, {B,C}, {B,D}
Prime attributes: {A,B,C,D}
```

Cada atributo lista todas las keys que lo contienen. Ninguna se etiqueta como
primary key.

### Case E — BCNF lossless, dependency no preservada

```text
R(A, B, C)
F = { AB → C, C → B }
BCNF leaves: {A,C}, {B,C}
Lost dependency: AB → C
```

La descomposición se etiqueta lossless por garantía del algoritmo. El checker
muestra `Not preserved` y `AB → C` como evidencia principal, con la aclaración
de que no se perdieron datos.

### Case F — determinante y candidate key vacíos

```text
R(A, B)
F = { ∅ → A, A → B }
Candidate key: ∅
Prime attributes: ∅
∅⁺ = {A,B}
2NF / 3NF / BCNF: satisfied
```

La UI dice `empty-set candidate key`, no `no candidate key`. Explica que no hay
prime attributes porque la única candidate key no contiene atributos. Closure
con ninguna selección conserva el input `∅`.

También se prueba el estado `F = ∅`, donde `∅⁺ = ∅` y no determina todos los
atributos de una relación no vacía.

## 24. Test strategy futura

### Builders y verdad matemática

- fixtures tipados para cada violation DTO y cada caso A–F;
- snapshot textual sólo para copy estable; assertions semánticas para regla,
  evidencia, conclusión y provenance;
- property-style checks de que un builder nunca nombra IDs fuera de su snapshot;
- 2NF nunca usa transitividad como criterio;
- 3NF siempre expresa ambas alternativas y una violación niega ambas;
- BCNF nunca concede la excepción prime;
- Minimal Cover nunca usa lenguaje de execution trace;
- primary key nunca se atribuye a una candidate key;
- empty set no se confunde con dato ausente.

### Data y stale state

- mapping de prime origins con múltiples keys;
- set comparison de Closure independiente del orden y vinculada a su snapshot;
- anomalías de IDs degradan a `Unknown attribute`/contract error, sin claims;
- editar el draft conserva explicación stale y no altera su lookup;
- abrir ayuda no cambia dirty state, revision ni serverRevision;
- ninguna interacción educativa llama Analyze/Closure/transformation.

### Componentes y progressive disclosure

- Level 1 visible inicialmente; Level 2/3 cerrados;
- Level 3 puede abrirse sólo mediante acción explícita;
- conteos, labels y evidencia permanecen asociados;
- teclado completo sobre summary/buttons/popover;
- accessible names de `∅`, `X⁺`, `X → Y` y `R(...)`;
- headings/regions y `aria-expanded` correctos;
- live regions no anuncian toggles educativos;
- 320, 360 y 390 px sin overflow de página y con DOM idéntico;
- transformaciones distinguen guaranteed, checked y not checked;
- lostDependencies visible antes que preservedDependencies;
- Case B valida específicamente `3NF satisfied / BCNF violated`.

Pruebas matemáticas siguen perteneciendo al engine. Los tests frontend prueban
que la UI representa evidencia, no que redescubre el resultado.

## 25. Out of scope

- explicaciones con IA, LLM o chat tutor;
- quizzes, gamification, onboarding obligatorio o animations;
- SQL generation, ER diagrams o selección de primary key;
- detección de 1NF;
- chase o prueba general de lossless join;
- 4NF/5NF;
- schema import o PDF export;
- colaboración, autosave, router o deep links;
- persistence de preferencias educativas;
- production hardening;
- nuevas rutas, DTO, endpoints o algoritmos.

## 26. Recommended implementation tranches

1. **Educational foundations:** tipos/builders de contenido, primitivas de
   notación accesible, Candidate Keys, Prime Attributes y Minimal Cover.
2. **Normal-form reasoning:** jerarquía 1NF*/2NF/3NF/BCNF y disclosures Level
   2/3 con casos 2NF→3NF y 3NF→BCNF.
3. **Closure education (implementada):** resultado Selected/Closure/Superkey,
   atributos determinados/faltantes, empty set y stale snapshot sin requests
   automáticos.
4. **Transformation provenance (implementada):** síntesis, BCNF steps,
   garantías y dependency preservation claramente separados. Usa disclosures
   hermanos para Why y formal reasoning, conserva el resultado durante retries
   y resuelve toda notación contra el analyzed snapshot histórico.
5. **Concept help and hardening:** glossary responsive, accesibilidad, mobile y
   regresión integral A–F.

Cada tranche debe incluir tests frontend proporcionales y no modificar el
Normalization Engine ni API v1.

## 27. Riesgos y trade-offs

- **Más copy puede ocultar evidencia.** Mitigación: Level 1 permanece igual de
  compacto y lost/violation evidence precede a teoría.
- **Garantía puede parecer un checker.** Mitigación: provenance visible y tres
  vocabularios fijos: guaranteed, observed/checked, not checked.
- **Los mismos hechos se repiten entre 3NF y BCNF.** Se acepta porque las reglas
  difieren; cada explicación mantiene su contexto.
- **La ayuda híbrida añade patrones.** En mobile todo contenido esencial cae a
  disclosure inline; popover sólo mejora desktop.
- **Copy contractual puede quedar desactualizado respecto del engine.** Builders
  y documentación se testean contra DTO kind y garantías versionadas.
- **No mostrar trazas limita la pedagogía.** Es preferible a inventarlas; una
  futura trace requiere decisión explícita de API/engine.

## 28. Next step

Implementar la tranche 5, **Concept help and hardening**: glossary responsive,
accesibilidad y mobile hardening, seguido de una auditoría integral de v1.1. No
adelantar cambios de producción/deployment ni lógica matemática en el frontend.
