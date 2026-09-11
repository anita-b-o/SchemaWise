# Workspace UX

> Educational UX v1.1 extends this implemented v1 baseline. The normative
> progressive-disclosure, explanation, notation, mobile and data-sufficiency
> decisions are documented in
> [educational-ux-v1.1.md](./educational-ux-v1.1.md). Where this baseline uses a
> shorter explanation, the v1.1 document takes precedence for future work.

## Jerarquía de escritorio

En desktop el workspace usa dos regiones, pero no dos columnas simétricas. El
editor ocupa aproximadamente 40% con ancho mínimo cómodo; los resultados usan
el resto para evidencia y transformaciones. Un header compacto permanece sobre
ambos. El botón de análisis cierra el editor, no flota globalmente.

Antes del primer resultado, el editor puede ocupar un ancho mayor y la región
derecha es una ayuda discreta. Después del análisis se establece la división.
No se encierra cada subsección en una card: superficies, separadores y espacio
crean la jerarquía.

```text
+--------------------------------------------------------------------------+
| SchemaWise · Relational normalization          How it works  Load example|
+-------------------------------+------------------------------------------+
| DEFINE SCHEMA                 | ANALYSIS                                 |
|                               | R(A, B, C)              Current          |
| Relation [ R______________ ]  |                                          |
|                               | Candidate keys    { A }                  |
| Attributes              3 / 6| Prime attributes  A                      |
| A             Rename  Remove |                                          |
| B             Rename  Remove | Normal forms                             |
| C             Rename  Remove | 2NF  [check] Satisfied                   |
| + Add attribute              | 3NF  [x] Violated · 1 issue              |
|                               | BCNF [x] Violated · 1 issue              |
| Dependencies           2 / 12|                                          |
| A  ->  B         Edit Remove | Minimal cover                            |
| B  ->  C         Edit Remove | A -> B                                   |
| + Add dependency             | B -> C                                   |
|                               |                                          |
| Assumes the relation is in 1NF| [View 3NF violation] [View BCNF violation]|
| [ Analyze schema ]           |                                          |
+-------------------------------+------------------------------------------+
```

## Relation and attribute editor

`Relation name` es un input con label persistente, máximo visible y mensaje de
error asociado. Los nombres se recortan sólo para validar; la UI no modifica
silenciosamente el valor enviado.

Cada atributo mantiene:

```ts
type AttributeDraft = {
  id: string;
  name: string;
};
```

Al crearlo, la UI genera una identidad opaca compatible con el máximo de 64
caracteres (por ejemplo `attr_` más `crypto.randomUUID()`). Esa identidad no
cambia al renombrar y no aparece en el flujo normal. Un disclosure global
`Advanced details` puede mostrarla en sólo lectura para depuración y aprendizaje
del contrato; no permite editarla en el MVP.

Los nombres visibles deben ser únicos tras trim y comparación case-insensitive
en el draft. El API permite que IDs distintos compartan display name, pero la UI
lo bloquea porque haría ambiguos los selectores y las explicaciones. La UI no
cambia el case ni crea IDs desde el nombre.

`Add attribute` inserta una fila enfocada. Enter confirma; Escape cancela una
fila nueva sin contenido. Rename conserva el ID. Remove es inmediato si no hay
referencias; si las hay, muestra las FDs afectadas y exige confirmar `Remove
attribute and N dependencies`. Nunca deja referencias huérfanas. Al llegar a 6,
el contador permanece visible y el control se deshabilita con `6 attribute
limit reached`.

## Functional dependency editor

La creación ocurre en un único composer visual. Para el máximo actual de seis
atributos, cada lado usa un `fieldset` de checkboxes nativos en lugar de un
multiselect personalizado:

```text
Left side                         Right side
[ A x ] [ B x ] [ + attribute ]  ->  [ C x ] [ + attribute ]
                                      [ Add dependency ]
```

Cada lado es un selector múltiple basado en la lista de atributos y excluye
duplicados en ese mismo lado. Un atributo puede estar en ambos lados porque el
contrato lo permite. Las selecciones mantienen el orden de atributos del draft
para una lectura estable; el servidor sigue decidiendo el orden canónico de
outputs.

El comportamiento de teclado es el nativo: Tab recorre los checkboxes y Space
alterna cada atributo, sin un patrón ARIA personalizado.

Por defecto ambos lados requieren al menos un atributo. `Advanced dependency`
permite marcar explícitamente `Use empty set` de forma independiente en LHS o
RHS. Se muestra `empty set` como `∅`, acompañado por texto accesible. Un RHS
vacío muestra una nota: `This dependency is trivial and may disappear from the
minimal cover`; no se prohíbe.

`Add dependency` se deshabilita con razón visible si no hay atributos, falta un
lado en modo normal o se alcanzaron 12. Una FD visualmente duplicada (comparando
ambos conjuntos sin depender del orden) se rechaza localmente. Tras agregarla,
el composer se limpia y conserva el foco. Cada fila existente tiene `Edit` y
`Remove`; Edit reutiliza el mismo composer in situ y `Cancel` restaura el valor.
No hay drag-and-drop porque el orden de FDs no tiene significado matemático.

```text
Relation: R                       Attributes 3 / 6
[A] [B] [C]

Functional dependencies                              2 / 12
+-----------------------------------------------------------+
| A                 -> B                    Edit  Remove     |
| B                 -> C                    Edit  Remove     |
+-----------------------------------------------------------+
| Left side              -> Right side                     |
| [ Select attributes ]     [ Select attributes ]          |
| Advanced dependency                 [ Add dependency ]   |
+-----------------------------------------------------------+
```

## Validation and request states

Local validation occurs on blur for fields and on attempted submission for the
whole draft. It covers empty/overlong names, duplicate visible names, counts,
incomplete normal-mode FDs, duplicate selections/FDs and stale references. The
first invalid field receives focus and the top of the editor shows a compact
summary only when multiple errors exist.

`Analyze schema` states:

| State | Presentation and behavior |
| --- | --- |
| Idle invalid | Disabled; nearby text names the next required correction. |
| Idle valid | Primary label `Analyze schema`. |
| Loading | Label `Analyzing…`; controls remain readable. Repeating the action restarts analysis with the current snapshot and aborts the prior request. |
| Success | Results update; a polite live message says `Analysis complete`. Button returns to its normal label. |
| API validation error | Map stable error code/details to the relevant section when possible; retain input and show the server message as supporting detail. |
| Unexpected/network error | Inline banner: `We couldn't analyze this schema. Try again.` with `Retry`; retain any previous result. |

No progress percentage is shown. A second analyze aborts/replaces an obsolete
request when supported; responses carry a local request ID so a late response
cannot overwrite a newer draft/result.

## Results information architecture

The results start with relation notation and a `Current` or `Out of date`
marker. They follow this order:

1. Key facts: candidate keys and prime attributes.
2. Normal-form summary: 2NF, 3NF and BCNF status with violation counts.
3. Minimal cover in mathematical rows.
4. Expandable violation explanations, grouped by normal form.
5. Contextual transformation actions and their results.

Sets use braces and visible names: `{ A, B }`; the empty set is `∅`. Because
sets have no mathematical order, the presentation orders their members by the
analyzed relation snapshot instead of exposing variable engine traversal order.
FDs use the arrow glyph with accessible text: `A B -> C` for assistive
technology. Candidate keys are separate set tokens/lines, not a comma-flattened
string. Pills are reserved for compact sets and statuses, not for every label.

```text
ANALYSIS FOR R(A, B, C)

Candidate keys                 Prime attributes
{ A }                          A

NORMAL FORMS
2NF  [check icon] Satisfied
3NF  [x icon] Violated       1 violation   [Show why]
BCNF [x icon] Violated       1 violation   [Show why]

Assumes the relation is already in 1NF.  What does this mean?

MINIMAL COVER
A -> B
B -> C
```

## Deterministic explanations

Educational UX v1.1 keeps these templates deterministic but splits them into
Level 2 contextual summaries and Level 3 formal reasoning. Builders must follow
the provenance-aware model in
[educational-content-model.md](./educational-content-model.md); in particular,
they may use violation collection semantics but may not reconstruct Closure or
Minimal Cover traces.

Templates resolve IDs through the response relation, never recompute the
analysis and never parse server messages.

For each 2NF violation:

```text
{A} -> C
Candidate key: {A, B}
{A} is a proper subset of this candidate key, and C is non-prime.
Therefore C partially depends on a candidate key, violating 2NF.
```

For each 3NF violation:

```text
B -> C
B is not a superkey.
C is not a prime attribute.
Therefore this dependency violates 3NF.
```

For each BCNF violation:

```text
B -> C
B is not a superkey.
BCNF requires every non-trivial determinant to be a superkey.
Therefore this dependency violates BCNF.
```

The UI may derive the display facts `non-prime` by membership in
`primeAttributes`, and label a determinant non-superkey because the backend
placed it in the corresponding violation collection. It does not calculate
closures to prove these claims. Duplicate-looking evidence across 3NF and BCNF
remains in its own conceptual section; copy explains the differing rule.

## Transformations

An action is displayed beside a violated form:

- `Generate 3NF synthesis` when 3NF is violated;
- `Generate BCNF decomposition` when BCNF is violated.

If the form is satisfied, the default view states that no transformation is
needed and offers no prominent action. Transformations use the current analyzed
snapshot, never the mutable draft. Each has independent idle/loading/success/
error state and can be retried. Running one does not run the other or replace
the analysis. Editing the draft keeps completed transformations visible as part
of the previous analysis, but disables every new transformation with `Analyze
the updated schema before generating a transformation.` A successful analysis
of a new revision clears synthesis, BCNF and preservation results together.
Retries keep their previous result visible while updating and after a failure.

### 3NF synthesis

Relations appear as a simple ordered list using generated display labels
`S1`, `S2`, etc. These are UI labels only, not schema names:

```text
3NF SYNTHESIS
Dependency preserving · Lossless join

S1 { A, B }      From minimal cover
S2 { B, C }      From minimal cover

Candidate-key relation added: No
[Hide synthesis]
```

`source: minimal-cover` maps to `From minimal cover`; `candidate-key` maps to
`Added to include a candidate key`. When `addedCandidateKey` is non-null, a note
names that exact set and explains why the extra relation exists. No PK, FK or
SQL ownership is inferred.

### BCNF decomposition

Leaf relations appear first, followed by `Show decomposition steps`. Each API
step renders with semantic HTML/CSS as a parent, labeled split and two children;
no graph library is required. For multiple steps, matching attribute sets link
the sequence visually, while the ordered textual list remains authoritative.

```text
BCNF DECOMPOSITION
Lossless join · Dependency preservation not guaranteed

Leaf relations:  R1 { B, C }    R2 { A, B }

Step 1
R { A, B, C }
    split on B -> C
    +-- R1 { B, C }
    +-- R2 { A, B }

[ Check dependency preservation ]
```

The preservation action lives inside the BCNF result after the leaves. It sends
the original analyzed schema plus `relations.map(r => r.attributes)` as
`decomposition`. Its result is adjacent:

```text
[check] Preserved
All dependencies in the original minimal cover are preserved.
```

or:

```text
[x] Not preserved
Lost dependencies
A B -> C
[Show preserved dependencies]
```

The UI does not imply that BCNF failed when preservation is false; it presents
two separate properties. The explanatory copy distinguishes them explicitly:
lossless join is reconstruction without loss of information, while dependency
preservation is the ability to check dependencies locally without recomposing
relations. By construction, 3NF synthesis is dependency-preserving and lossless;
BCNF decomposition produces BCNF leaves and a lossless decomposition, but does
not guarantee dependency preservation.

## Closure tool

`Tools` is a secondary disclosure below the editor on desktop and after input
on mobile. `Attribute closure` opens a compact panel using the current draft:

```text
ATTRIBUTE CLOSURE
Starting attributes  [ A x ] [ + attribute ]
[ Calculate closure ]

A+ = { A, B, C }
```

The empty starting set is allowed and displayed as `∅+`. The request uses the
same schema validation as Analyze. A closure result becomes `Out of date` after
any input edit. It does not require a prior analysis and never occupies the
main results summary.

The panel preserves `selectedAttributes`, `inputRevision`, the exact
`inputSnapshot` and the response in the workspace resource. Recalculation
aborts the previous request and request IDs prevent late responses from
replacing a newer result. Errors remain local to the tool; an abort is silent.

## Mobile

At narrow widths, the page becomes one column in task order: header, editor,
Analyze CTA, result summary, violation details, transformations, tools. Results
do not sit beside inputs and the button is full width but not sticky by default.
The layout must use the browser's available content width at 320 CSS pixels,
including environments with a non-overlay scrollbar; the page itself must not
introduce horizontal scrolling. Native disclosures, quiet actions and checkbox
labels keep an approximately 44 CSS pixel target without changing the compact
visual language.

```text
+----------------------------+
| SchemaWise                 |
| How it works  Load example |
+----------------------------+
| DEFINE SCHEMA              |
| Relation [ R________ ]     |
| Attributes          3 / 6 |
| A   Edit Remove            |
| B   Edit Remove            |
| C   Edit Remove            |
| + Add attribute            |
|                            |
| Dependencies       2 / 12 |
| A -> B        Edit Remove  |
| B -> C        Edit Remove  |
| + Add dependency           |
|                            |
| [ Analyze schema         ] |
+----------------------------+
| ANALYSIS                   |
| Candidate key  { A }       |
| Prime attribute A          |
| 2NF  Satisfied             |
| 3NF  Violated  [Show why]  |
| BCNF Violated  [Show why]  |
| Minimal cover              |
| A -> B                     |
| B -> C                     |
+----------------------------+
```

Conceptual breakpoints are content-driven: single column when the editor and a
readable result cannot each retain their minimum width; two-column workspace
above that; a capped wide layout on large screens. Exact pixels are decided
during implementation with real content, not treated as product API.
