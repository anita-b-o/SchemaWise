# Frontend MVP

Estado: propuesta de producto y UX previa a implementación.

## Alcance

El MVP convierte el API computacional v1 en un workspace sin cuenta donde una
persona define una relación y sus dependencias funcionales, ejecuta el análisis,
entiende la evidencia y solicita transformaciones de forma explícita.

Incluye:

- edición de una relación con entre 1 y 6 atributos;
- edición visual de hasta 12 dependencias funcionales;
- análisis agregado de claves candidatas, atributos primos, minimal cover, 2NF,
  3NF y BCNF;
- explicaciones determinísticas a partir de la evidencia del API;
- síntesis 3NF y descomposición BCNF bajo demanda;
- comprobación de preservación para las hojas de una descomposición BCNF;
- cálculo secundario de cierre de atributos;
- un ejemplo educativo opcional y reemplazable.

No incluye persistencia, recuperación automática, cuentas, proyectos,
colaboración, sharing, analytics, pagos, IA, inferencia de 1NF ni conceptos SQL
como PK/FK. Tampoco agrega algoritmos o endpoints en el navegador.

## Propuesta de entrada

La ruta `/` abre directamente el producto. Un encabezado compacto explica en
una frase qué hace SchemaWise y ofrece `Load example` y `How it works`; no existe
una landing que retrase el primer uso ni un onboarding obligatorio. Esto sirve
al uso real y al portfolio: el producto y su demostración son la misma página.

`How it works` abre contenido de ayuda no modal dentro de la página (popover en
desktop, disclosure en mobile). No requiere una ruta en v1.

## Flujo principal

```text
Open workspace
  -> name relation
  -> add/rename attributes
  -> compose functional dependencies
  -> Analyze schema
  -> scan results overview
  -> inspect violations
  -> optionally generate 3NF synthesis or BCNF decomposition
  -> optionally check preservation for the BCNF result
```

El orden se sugiere con jerarquía y estados habilitados, no mediante un wizard.
La persona puede volver a cualquier campo. Editar el esquema después de un
análisis conserva el resultado visible pero lo marca `Out of date`; las acciones
de transformación quedan deshabilitadas hasta analizar de nuevo.

## First use y empty states

La primera vista dedica el espacio principal al input. El área de resultados no
se presenta como un panel vacío de igual peso: muestra una guía breve y se
expande visualmente después del primer análisis.

```text
+--------------------------------------------------------------+
| SchemaWise                       How it works   Load example  |
| Understand and normalize a relational schema.                |
+--------------------------------------------------------------+
| Define your schema                                            |
| Relation name  [ R________________ ]                          |
| Attributes     0 / 6                                         |
| [ Add attribute ]                                             |
|                                                              |
| Functional dependencies  0 / 12                              |
| Add attributes first to build a dependency.                  |
|                                                              |
| [ Analyze schema ] (disabled)                                |
+--------------------------------------------------------------+
| Results will appear here after the schema is ready.           |
+--------------------------------------------------------------+
```

`Load example` reemplaza el draft actual sólo después de confirmación si ya hay
contenido. Carga `R(A,B,C)` con `A -> B` y `B -> C`, pero no ejecuta el análisis:
el usuario conserva el momento causal entre input y resultado.

## Principios de producto

- La notación matemática es contenido primario, no decoración.
- El resumen responde primero “qué ocurre”; el detalle responde “por qué”.
- Las transformaciones son decisiones separadas, no efectos laterales de
  `Analyze schema`.
- El navegador aplica validaciones obvias y el API conserva autoridad final.
- Un estado imposible nunca se crea silenciosamente.
- El diseño muestra las garantías exactas: 3NF synthesis preserva dependencias;
  BCNF decomposition puede no hacerlo.

## 1NF

Una nota persistente y tranquila aparece junto al encabezado de formas normales:

> Analysis covers 2NF, 3NF, and BCNF, assuming the relation is already in 1NF.

Se presenta con icono informativo y texto, sin fila `1NF`, check verde ni
apariencia de advertencia. Un disclosure `What does this mean?` explica que la
atomicidad de los valores no puede inferirse de las dependencias funcionales.

## Decisiones diferidas

- No se usa `localStorage` en la primera implementación. Recuperar drafts es
  útil, pero introduce versionado, consentimiento de borrado y estados antiguos.
- No se serializa el esquema en URL: con IDs internos y 12 FDs la URL sería un
  contrato de sharing prematuro.
- No se añade router hasta que exista una segunda ruta real.
- No se precarga el ejemplo automáticamente ni se guarda un proyecto.

