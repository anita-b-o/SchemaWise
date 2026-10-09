# SchemaWise Demo v1 — plan de pruebas

Estado: **TRANCHE 3 IMPLEMENTADO — auditoría integral pendiente (Tranche 4)**

Alcance: Demo `/demo`, no despliegue. Las regresiones de `/` y
`/projects/:projectId` siguen siendo gates obligatorios.

## Evidencia implementada en Tranche 1

`shared-workspace-core.test.tsx` monta `SharedWorkspaceCore` con sólo un
`SchemaWiseApi` matemático: no recibe `ProjectApi`, Auth ni callbacks de
persistencia, y verifica que el draft sigue siendo propiedad del único reducer
del núcleo. Las suites existentes de navegación de superficie, snapshots,
Project Recovery y OCC permanecen como regresión del host persistente.

Las suites `demo-fixtures.test.ts` y `demo-route.test.tsx` cubren fixtures
inmutables, IDs deterministas, Basic inicial bajo StrictMode, aislamiento de
Auth/Projects, direct links, historial, selector, blank, reemplazo
confirmado/cancelado, misma selección, abort y dirty frente a stale.

## Resultado de Tranche 3 (2026-10-08)

- Typecheck, build y `git diff --check` son gates requeridos de Tranche 3.
- La suite añade siete casos Web de Demo sin debilitar regresiones de API,
  engine ni Project Recovery.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- Chromium local con `createServer` matemático real: un POST cada uno a
  `/closure`, `/analysis`, `/synthesis/3nf`, `/decomposition/bcnf` y
  `/analysis/dependency-preservation`. Cambiar superficies y usar Back/Forward
  emitió 0 requests nuevos. Mientras Demo estuvo montada hubo 0 requests Auth
  y 0 Projects. El GET `/auth/me` se observó sólo tras salir a `/`.
- Navegador: Analyze llevó a Analysis; Transform ejecutó tres operaciones;
  editar tras Analyze conservó el snapshot y mostró `Out of date`; salir dirty
  mostró confirmación; volver creó una instancia vacía sin resultados; refresh
  conservó `view` y descartó el draft. Direct links a Analysis y Transform
  mostraron empty states sin red.
- Chromium: `scrollWidth - innerWidth = 0` en 320×720, 390×844, 768×1024 y
  1440×900. Axe WCAG 2 A/AA y 2.1 A/AA: 0 violaciones en Demo Schema,
  Analysis vacío, Transform vacío y confirmación de salida. Sin page errors.
- Project Recovery: pasaron las 24 pruebas de `project-workflows.test.tsx`, las
  12 de `project-route.test.tsx` y las demás regresiones Web existentes.

La matriz inferior describe el objetivo completo de Demo v1. D-08 a D-14 y
D-26 están cubiertos por las suites Demo; D-16 a D-19 siguen reutilizando el
núcleo matemático y sus contratos comunes. La auditoría integral de navegador,
axe y regresión cruzada queda expresamente para Tranche 4 y no se marca aquí
como completada.

## Estrategia y harness

- Unit: Vitest para fixtures, igualdad de baseline, identidad y reducer.
- Component/integration: Testing Library + `createMemoryRouter`, `StrictMode`,
  `AuthApi`/`ProjectApi` spies que fallan si son invocados, y `SchemaWiseApi`
  spies/implementación real local según el caso.
- Browser: Vite build, SPA refresh, navegación Back/Forward real, interceptación
  de red, axe-core y viewports. Ningún mock de fixture sustituye respuestas
  matemáticas en los casos que prueban corrección/endpoints.
- Regression: suites existentes de auth, project route, project workflows,
  workspace foundations, view navigation, closure y transformaciones.

## Matriz de aceptación

| ID | Riesgo/contrato | Método | Evidencia esperada |
| --- | --- | --- | --- |
| D-01 | Ruta hermana no monta Auth | integración StrictMode en `/demo` | `auth.me`, login, register, logout: 0; no request `/auth/*`. |
| D-02 | Ruta Demo no toca Projects | integración con ProjectApi que lanza | create/list/get/update/delete: 0; no request `/projects*`. |
| D-03 | Ruta normal no regresa | regresión `/` y `/projects/:id` | Auth/hidratación vigente conservados; suites actuales pasan. |
| D-04 | Identidad independiente | unit `workspaceResourceIdentity` | `/` = root; project = project; cada Demo view = `DEMO WORKSPACE`. |
| D-05 | URLs autorizadas | router | `/demo`, Analysis y Transform; `view=foo` da Schema sin requests. |
| D-06 | URL desconocida | router/browser | `/demo/foo` usa not-found global, sin Auth/Project/Math. |
| D-07 | Default efímero | integración | entrada pone Basic, Schema, recursos idle, cero POST. |
| D-08 | Fixtures correctos e inmutables | unit | cuatro IDs y esquema/FD exactos; mutar un draft clonado no cambia fixture. |
| D-09 | IDs Enrollment deterministas | unit + motor real | orden `d,c,a,b,e,f` y cinco FDs documentadas; salida BCNF de regresión estable. |
| D-10 | Blank | componente | `Start from scratch` deja relación/attrs/FDs vacíos y baseline limpio. |
| D-11 | Reemplazo limpio | componente | selector cambia draft, cancela recursos en vuelo y no pide confirmación. |
| D-12 | Reemplazo dirty | componente/keyboard | confirmación; Cancel preserva todo; Confirm reemplaza, limpia stale/resultados y dirty. |
| D-13 | Misma selección | componente | no dispatch/revision/request/confirmación. |
| D-14 | Dirty semántico | unit/componente | edición marca dirty; restaurar baseline lo limpia; Analysis/Closure/resultados no lo cambian. |
| D-15 | Stale histórico | reducer + componente | edición post-Analyze muestra datos históricos y `Out of date`; dirty/stale se prueban independientes. |
| D-16 | Analyze real | integración con spy/API local | un POST `/analysis` con clone del fixture, navega Analysis sólo en éxito. |
| D-17 | Closure real | integración | un POST `/closure`, snapshot y selección correctos; no Analyze implícito. |
| D-18 | Transform reales | API local/motor | un POST por 3NF, BCNF y preservation, DTO correcto; no precálculo. |
| D-19 | Conteo por operación | deferred requests + doble click | mientras loading cada botón está disabled; una activación aceptada = un request. Reintento posterior = uno nuevo. |
| D-20 | Navegación superficial | router | Schema↔Analysis↔Transform conserva reducer/resultados, no prompt y cero POST. |
| D-21 | Direct Analysis/Transform | router | empty state correspondiente, no cálculo ni red automática. |
| D-22 | Salida limpia | router | `/demo` → `/` o project procede sin confirmación; Demo se desmonta. |
| D-23 | Salida dirty | router/keyboard | wordmark/link/Back/Forward bloquean; Stay conserva URL/draft y devuelve foco; Discard procede una vez. |
| D-24 | No revivir descarte | browser POP | editar Demo, Back + Discard, Forward a Demo: Basic nuevo, no draft/snapshot/resultados antiguos. |
| D-25 | Refresh efímero | browser refresh | tras editar/resultados, refresh vuelve a Basic limpio/idle; 0 auth/project requests. |
| D-26 | Requests tardíos | deferred APIs | cambiar fixture/salir aborta; respuesta vieja no modifica instancia nueva. |
| D-27 | A11y selector y dialogs | Testing Library + axe | labels, focus, roles, teclado Enter/Escape si se usa, cero violations en estados clave. |
| D-28 | Responsive | browser | 320, 360, 390, 768, 1280 px; selector/toolbars/resultados/footer sin overflow horizontal. |
| D-29 | Footer/identidad | component/browser | Pampa Software visible; no landing, wizard ni navegación global adicional. |
| D-30 | Seguridad UI | static/import + network test | Demo host no importa Auth/Project UI/API; sólo endpoints matemáticos autorizados. |

## Casos matemáticos de extremo a extremo

Ejecutar contra `createServer` o API local real, no respuestas hardcodeadas:

1. Basic: analizar `R(A,B,C), A→B, B→C`; generar 3NF/BCNF cuando las
   precondiciones del resultado lo permitan y verificar conteos de red.
2. Composite key: verificar que `A→C` en `R(A,B,C)` conserva la entrada exacta
   y que closure permite seleccionar atributos por ID estable.
3. 3NF versus BCNF: comprobar que `AB→C, C→B` demuestra la diferencia prevista
   mediante los resultados reales, no copy estático.
4. Enrollment: comprobar candidate key `{Student, Course}`, 3/44/44
   diagnósticos, cuatro relaciones 3NF, cuatro BCNF, tres pasos BCNF y pérdida
   `Department → Office`, como regresión ya documentada.

Cada escenario registra exactamente los POST iniciados por interacción. Abrir
disclosures, diagramas, selector, navegación, stale y errores no añade POST.

## Regresión Project Recovery obligatoria

Ejecutar sin editar su intención las suites existentes y añadir aserciones de
no interferencia:

- `auth-context.test.tsx`: una inicialización Auth por provider productivo;
  ninguna desde Demo.
- `project-route.test.tsx`: UUID inválido sin GET; direct/open/retry/races;
  Auth gate y títulos/foco conservados.
- `project-workflows.test.tsx`: Save POST/PUT, adopción sin GET, Delete/404
  detach, OCC, logout/reconnect, blocked POP y beforeunload.
- `workspace-view-navigation.test.tsx`: `?view=` preserva recursos y no
  computa; Save/Open/New/Recovery conservan sus semánticas.
- `workspace-foundations.test.ts`, `closure-tool.test.tsx` y
  `transformation-workflows.test.tsx`: snapshots, stale, aborts y endpoints
  comunes siguen iguales.

Agregar un caso cruzado: Demo dirty → salir a `/` con descarte → crear/abrir un
proyecto; confirmar que el proyecto comienza con su propio estado y no recibe
ni el draft ni resultados Demo. Y el inverso: proyecto dirty → intento de ir a
`/demo` permanece bloqueado por el coordinador de Projects; tras descarte,
Demo inicia Basic sin GET de proyecto adicional.

## Gate final de QA

1. `npm run typecheck`, `npm test`, `npm run build` y `git diff --check`.
2. Conteos de red de D-01, D-02 y D-16 a D-19 bajo StrictMode.
3. Browser: direct entry, POP, Forward tras discard y hard refresh.
4. axe-core en Schema Demo inicial/dirty/confirmación, Analysis current/stale,
   Transform completo Enrollment y estado mobile.
5. Viewports de D-28 y consola sin errores/requests inesperados.

Un fallo de cero Auth/Projects, persistencia, aislamiento de estado, request
count, Project Recovery o accesibilidad bloquea el tranche; no se compensa
ocultando controles ni ajustando expectativas de prueba.
