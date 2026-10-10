# SchemaWise Demo v1 — auditoría pública

Fecha: 2026-10-10 (America/Argentina/Buenos_Aires). Resultado funcional:
**SCHEMAWISE DEMO V1 PUBLIC: PASS**.

## Release auditado

- SHA funcional: `a94fae95baddea3b9c254ac6a2c3a20d689a7a9b`.
- Preflight: `master` 12 commits adelante de `origin/master`, árbol limpio;
  diff sólo en `apps/web`, documentación y `package-lock.json`. Sin cambios en
  API, engine, migraciones ni infraestructura.
- Push: `bac5f9d..a94fae9 master -> master`, sin force ni tag.
- GitHub CI: [run 38058383731](https://github.com/anita-b-o/SchemaWise/actions/runs/38058383731),
  `completed/success` para el SHA funcional. Typecheck, Test, Build y Audit
  runtime dependencies aprobaron. Test: API 142, Web 237, engine 173; total
  **552**. Auditoría runtime: **0 vulnerabilidades**. No se repitieron los gates
  locales completos porque el SHA y el árbol coincidían con el baseline aprobado.
- Vercel auto-deploy de producción: `dpl_76RozsMaqPBJzM1sBpGNamPrjkug`,
  `READY`, commit `a94fae9`; el alias `schemawise.vercel.app` apuntó a ese ID.
  No se inició deployment manual.

## Rutas, Render y proxy

`/`, `/demo`, `/demo?view=analysis` y `/demo?view=transform` respondieron HTTP
200 con HTML. Las deep links preservaron la superficie pedida y el fallback SPA.
El proxy same-origin `POST /api/v1/analysis` devolvió HTTP 200 y JSON real;
no devolvió `index.html`.

Render `https://schemawise-api-staging.onrender.com` respondió `/health` HTTP
200 `{"status":"ok"}` y `/ready` HTTP 200 `{"status":"ready"}`. Se respetó
el cold start de la instancia gratuita. No hubo redeploy ni keepalive.

## Demo anónima y aislamiento

La entrada mostró Basic normalization, `R(A,B,C)`, `A→B` y `B→C`, las cuatro
opciones de ejemplo más Start from scratch, Schema activa y ningún análisis
automático. `App.tsx` monta la ruta Demo fuera de `AuthProvider` y del workspace
de Projects. Durante las sesiones cuyo pathname era `/demo`, la captura de red
registró **0** `/auth/me`, login/register y requests GET/POST/PUT/DELETE de
Projects. La identidad de la superficie fue `DEMO WORKSPACE`; no hubo
`projectId`, OCC, Save/Open/New/Delete ni escrituras de proyecto. No se creó
ningún proyecto de prueba ni se modificó Neon.

Al salir hacia `/`, el workspace normal inició su propio `/auth/me` anónimo;
esas llamadas se atribuyen a `/` y no a Demo. Allí se observaron Sign in,
Open projects, New project, Save, Schema/Analysis/Transform y el footer Pampa
Software. Project Recovery conserva la cobertura de la suite Web aprobada;
no se creó un proyecto para reproducirla en producción.

## Matemática pública y requests

Cada activación matemática del recorrido principal produjo exactamente **un
POST** con HTTP 200 y JSON. Selección/reemplazo, navegación, Back/Forward,
Explain y Diagram produjeron **cero** requests matemáticos.

| Fixture | Resultado comprobado |
| --- | --- |
| Basic normalization | Candidate key `{A}`, prime `{A}`, 2NF satisfecha, 3NF y BCNF violadas por `B→C`. Analyze llevó a `?view=analysis` y enfocó `Analysis` h1. |
| Composite key | `R(A,B,C)`, `A→C`, candidate key `{A,B}`, 2NF violada. |
| 3NF versus BCNF | `AB→C`, `C→B`, dos candidate keys, 3NF satisfecha, BCNF violada. |
| Enrollment | Seis atributos, cinco FDs, key `{Student, Course}`, violaciones 2NF/3NF/BCNF `3/44/44`, Issues visibles `8 → 44 → 8`, minimal cover de cuatro FDs. |

Basic completó 3NF Synthesis (dos relaciones), BCNF Decomposition (dos
relaciones, un paso) y Dependency Preservation (preserved). Enrollment completó
3NF (cuatro relaciones, dependency preserving, lossless join), BCNF (cuatro
relaciones, tres pasos, lossless join) y Preservation (`Not preserved`), con
`Department → Office` como dependencia perdida.

Endpoints observados: `POST /api/v1/analysis`,
`POST /api/v1/synthesis/3nf`, `POST /api/v1/decomposition/bcnf` y
`POST /api/v1/analysis/dependency-preservation`. La sesión principal registró
11 POST matemáticos: cinco análisis (Basic inicial, reanálisis, Composite,
3NF versus BCNF y Enrollment), tres operaciones Basic y tres Enrollment.

## Lifecycle y navegación

- Schema → Analysis → Transform y Back/Forward mantuvieron datos y
  `aria-current`, sin blocker ni POST adicional.
- Editar un atributo dejó `Out of date`; Analysis, resultados y diagramas de
  Transform conservaron el snapshot histórico. El rerun incompatible quedó
  deshabilitado. Reanalyze devolvió `Current` e invalidó transformaciones
  anteriores.
- Reemplazo de un draft modificado mostró `alertdialog`; cancelar conservó el
  draft y confirmar cargó el otro fixture, limpió resultados derivados y no
  hizo requests. Salida limpia fue inmediata; salida dirty pidió confirmación.
  Back desde `/` montó una Demo nueva con Basic sin recuperar el draft.
- Recarga de `/demo` restauró Basic. Recargas de `?view=analysis` y
  `?view=transform` conservaron la superficie pedida como empty state, sin
  autoanálisis; al volver a Schema se observó Basic restaurado.

## Responsive y accesibilidad

En Chrome público, `320×720`, `360×800`, `390×844`, `768×1024`, `1024×768`,
`1280×800` y `1440×900` dieron `documentElement.scrollWidth == clientWidth`:
**cero overflow horizontal**. Selector y navegación estuvieron visibles en
todos. Diagramas abiertos de Analysis y Transform conservaron cero overflow en
los siete tamaños. La confirmación fue visible en 320 px.

Se comprobaron `main`, navegación Workspace, h1, selector etiquetado,
`alertdialog`, foco en Analysis tras Analyze, foco en Transform tras navegación,
notación en `code` y diagramas. Tab y Shift+Tab recorrieron y devolvieron foco
al selector; Space activó Analyze y Enter activó Transform, con foco final en
el h1 correspondiente.

| Estado axe | Violations | Incomplete |
| --- | ---: | --- |
| Demo inicial | 0 | `color-contrast` (1 nodo) |
| Analysis | 0 | `color-contrast` (1 nodo) |
| Transform | 0 | 0 |
| Enrollment | 0 | 0 |
| Confirmación | 0 | `color-contrast` (1 nodo) |
| Stale | 0 | `color-contrast` (1 nodo) |
| Mobile | 0 | `color-contrast` (1 nodo) |

Los resultados `incomplete` se registran separadamente; axe no pudo decidir
automáticamente el contraste de esos nodos. No se interpretaron como
violations ni como comprobación manual de contraste.

## Console, issues y límites

Durante Demo: cero errores de página y cero errores/warnings de consola
inesperados. Al abrir el workspace normal anónimo, el navegador registró el
HTTP 401 esperado de `/auth/me`; ocurrió después de salir de Demo.

No se encontraron defectos Critical, High, Medium ni Low causados por Demo en
la auditoría pública. No hubo correcciones productivas. La concurrencia y
cancelación permanecen cubiertas por pruebas locales; **no** se reprodujeron
carreras artificiales en público. La regresión de Project Recovery se apoya en
los tests Web previos y en la inspección sin escritura del workspace normal.

## Cierre documental

Este documento se añadió después de la auditoría funcional. El SHA documental
final, su CI y el auto-deploy posterior se consignan en el historial Git y en
la entrega del release; el SHA funcional auditado permanece `a94fae9`.

Siguiente paso: integrar `https://schemawise.vercel.app/demo` en el portfolio.
