# SchemaWise Demo v1 — arquitectura propuesta

Estado: **SCHEMAWISE DEMO V1: FROZEN — auditoría integral Tranche 4 aprobada (2026-10-10)**

Fecha: 2026-10-08
Alcance: experiencia temporal e independiente en `/demo`. La implementación
actual incluye ruta, host, aislamiento y biblioteca de ejemplos; no hubo cambios de backend,
migraciones, push ni despliegue.

## Estado implementado en Tranche 3

`/demo` es una ruta hermana del árbol productivo. Monta `DemoWorkspaceHost`,
`WorkspaceViewProvider` y el núcleo matemático compartido sin `AuthProvider`,
`ProjectRoute`, sesión ni capacidades de persistencia. La identidad es
`DEMO WORKSPACE`. Schema inicia con un clon de Basic normalization; ese clon
es el baseline temporal de dirty. El selector permite cargar los cuatro
ejemplos documentados o empezar vacío, sin persistencia ni cálculo automático.
Editar y restaurar exactamente el baseline vuelve a limpio. Analyze no se
ejecuta al entrar, al refrescar ni al cambiar `view`.
Analysis y Transform directos muestran sus estados vacíos. Refresh conserva
la superficie de la URL y reinicia el recurso. Salir dirty requiere confirmar;
volver mediante historial monta un recurso nuevo sin resultados anteriores.

El reemplazo de un draft modificado requiere confirmación inline y aborta las
operaciones en vuelo antes de instalar un clon nuevo. El footer, las cinco
operaciones matemáticas y Project Recovery conservan sus implementaciones.

## 1. Architecture audit

La aplicación actual tiene tres responsabilidades que hoy están entrelazadas en
el árbol de `/` y `/projects/:projectId`:

| Área | Implementación actual | Dependencia relevante para Demo |
| --- | --- | --- |
| Arranque | `App.tsx` monta `AuthProvider` fuera de `AppRoutes` para el catch-all | `AuthProvider` ejecuta `api.me()` en un efecto de montaje; una ruta Demo debajo de ese árbol haría `GET /auth/me`. |
| Recurso | `workspaceResourceIdentity` distingue `ROOT WORKSPACE`, `PROJECT:<uuid>` y `PATH:*` | Demo necesita su propia identidad estable; no puede ser root ni un proyecto. |
| Ruta de proyecto | `ProjectRoute` parsea UUID, espera Auth, hidrata con `projectsApi.getProject`, adopta POST y recupera errores | Ninguna parte de ese coordinador debe montarse para Demo. |
| Navegación | `ProjectNavigationCoordinator` bloquea cambios de identidad, gestiona `beforeunload`, adopción y detach | El patrón de bloqueo sirve, pero adopción/detach/Project API no pertenecen a Demo. |
| Workspace | `useSharedWorkspaceCore` monta un único `useReducer(workspaceReducer)` y conserva draft, revisión, Analysis, Closure, 3NF, BCNF y preservation | Es el motor de interacción que se debe reutilizar una sola vez por instancia de Demo. |
| Persistencia | `ProjectWorkspaceHost` importa Auth, `ProjectListPanel`, `ProjectSession` y ejecuta Save/Open/New/Delete | Ocultar la barra no basta: esas capacidades y callbacks no deben ser entregados a Demo. |
| Matemática | `schemawiseApi` ofrece POST a analysis, closure, 3NF, BCNF y preservation | Debe seguir siendo la única fuente de resultados; fixtures sólo son entradas. |

El reducer ya tiene el contrato adecuado para historia local: toda mutación de
draft aumenta `revision`, marca Analysis/Closure como `outOfDate`, retiene el
snapshot de entrada y descarta transformaciones sólo tras un nuevo Analyze
exitoso de una revisión distinta. `replaceDraft` y `resetWorkspace` reinician
los recursos derivados. Los request IDs evitan que una respuesta tardía se
aplique a un estado nuevo.

El contrato de Projects está correctamente separado en comportamiento, aunque
no aún en composición: `ProjectSession` determina dirty contra un snapshot
persistido; Save hace POST/PUT y puede adoptar un proyecto; Open y deep link
delegan el GET a `ProjectRoute`; Delete/404 hacen detach hacia `/`; 409 pide
reload; Auth reconnect puede rehidratar sólo un draft limpio. Demo no debe
participar de ninguno de esos caminos.

## 2. Routing and resource identity

La configuración final del router debe declarar rutas hermanas, no una Demo
anidada bajo el provider autenticado:

```text
Browser router
├─ /demo                  → DemoRoute (sin AuthProvider ni ProjectRoute)
└─ *                      → AuthProvider → ProductAppRoutes
                            └─ ProjectNavigationCoordinator → ProjectRoute
```

`ProductAppRoutes` conserva sin cambio observable `/` y `/projects/:projectId`.
La ruta Demo acepta:

| URL | Superficie | Efecto de entrada |
| --- | --- | --- |
| `/demo` | Schema | Inicializa una sesión Demo nueva con Basic normalization; no calcula. |
| `/demo?view=analysis` | Analysis | Mismo estado temporal; muestra estado vacío hasta Analyze. |
| `/demo?view=transform` | Transform | Mismo estado temporal; muestra estado vacío hasta Analyze. |
| `/demo?view=schema` o `view` desconocido | Schema | Misma normalización ya usada por `parseWorkspaceView`. |
| `/demo/...` o pathname no reconocido | Not found global actual | No se interpreta como proyecto ni como Demo. |

`workspaceResourceIdentity("/demo")` y cualquier `/demo?view=*` válido deben
resolver a `DEMO WORKSPACE`. La identidad no contiene un ID de fixture, nombre
de relación, resultado ni una UUID. El selector de ejemplo y `view` son estado
de superficie, no recurso. `/` sigue siendo exactamente `ROOT WORKSPACE`; un
proyecto sigue siendo `PROJECT:<uuid normalizado>`.

## 3. Auth isolation

La decisión vinculante es **no montar `AuthProvider` en la rama Demo**. No se
acepta un provider "anónimo", una llamada a `/auth/me` ignorada ni un flag
después de montarlo: el efecto actual de `AuthProvider` iniciaría esa llamada.

`DemoRoute`, `DemoWorkspaceHost` y los componentes comunes que éste use no
pueden importar o invocar `useAuth`, `AuthPanel`, `authApi`, `ProjectRoute`,
`ProjectNavigationCoordinator`, `ProjectRouteProvider` ni `ProjectListPanel`.
La prueba de integración debe fallar ante cualquier request cuyo pathname sea
`/api/v1/auth/*` o `/api/v1/projects*` durante toda una sesión Demo.

Esto no elimina Auth del producto ni modifica cookies, CSRF, rate limiting,
endpoints ni autorización de backend. Sólo elimina la capacidad de la rama de
UI Demo de provocar esas operaciones.

## 4. Persistence isolation

Demo no recibe `ProjectApi`, `ProjectSession`, CSRF token, project ID,
`initialProject`, adopción, hidrator ni callbacks Save/Open/New/Delete. La
barra de proyectos no se renderiza y, más importante, el código que llama a
`createProject`, `listProjects`, `getProject`, `updateProject` o
`deleteProject` no se monta ni se alcanza desde la rama Demo.

No se usa `localStorage`, `sessionStorage`, IndexedDB, query parameters,
`history.state` ni base de datos para draft, fixture seleccionado, snapshots o
resultados. `location.state` tampoco se reutiliza: está reservado hoy a la
adopción efímera de Projects. La memoria React de la instancia Demo es el único
almacenamiento permitido.

## 5. Workspace reuse

Se conserva **un único reducer por workspace montado**:
`useSharedWorkspaceCore` continúa siendo dueño de `workspaceReducer`, los
AbortControllers y las cinco operaciones matemáticas. No se crea un reducer
Demo, store global, motor duplicado ni resultados simulados.

Antes de implementar se debe separar el actual componente mixto en dos capas:

1. `useSharedWorkspaceCore` / `SharedWorkspaceCore` (núcleo común): reducer,
   snapshots, stale, validación, abortos y dispatch de `SchemaWiseApi`.
   `WorkspaceSurfaces` compone las superficies actuales Schema → Analysis →
   Transform sin otro reducer. `ProjectWorkspaceHost` sólo entrega su chrome y
   capacidades persistentes.
2. Host de recurso: `ProjectWorkspaceHost` entrega capacidades de persistencia;
   `DemoWorkspaceHost` entrega identidad Demo, baseline vacío y bloqueo de
   salida. El selector de fixtures pertenece a Tranche 3.

El contrato del núcleo es discriminado por capacidades, no por booleanos
sueltos. La variante `demo` no tiene propiedades de proyecto ni callbacks de
persistencia; TypeScript debe hacer imposible renderizar Save/Open/New/Delete
desde esa variante. El host Project preserva la actual UI y contratos de
Project Recovery. `WorkspacePage` seguirá siendo el adaptador de proyecto.

## 6. Example fixtures

Los fixtures se definen en un módulo dedicado, por ejemplo
`features/demo/demo-fixtures.ts`, como valores profundos inmutables y una
función `cloneDemoDraft`. Nunca se entrega el objeto congelado directamente a
un reducer mutable. El identificador de fixture es estable, visible sólo al
selector y distinto de la identidad de recurso `DEMO WORKSPACE`.

| ID de fixture | Relación y atributos (id → nombre) | Dependencias funcionales |
| --- | --- | --- |
| `basic-normalization` | `R`; `demo-basic-a → A`, `demo-basic-b → B`, `demo-basic-c → C` | `A → B`, `B → C` |
| `composite-key` | `R`; `demo-composite-a → A`, `demo-composite-b → B`, `demo-composite-c → C` | `A → C` |
| `third-normal-form-vs-bcnf` | `R`; `demo-3nf-a → A`, `demo-3nf-b → B`, `demo-3nf-c → C` | `AB → C`, `C → B` |
| `enrollment` | `Enrollment`; `d → Student`, `c → Course`, `a → Professor`, `b → Department`, `e → Grade`, `f → Office` | `Student, Course → Grade`; `Course → Professor`; `Professor → Department`; `Professor → Office`; `Department → Office` |

Los IDs del cuarto caso son deliberadamente los IDs estables de la regresión
matemática vigente: el orden de IDs afecta una descomposición BCNF válida y
determinista. Todos son strings no vacíos y menores al límite de 64 caracteres,
compatibles con DTOs y validadores actuales. Los cuatro fixtures contienen sólo
input; no incluyen candidate keys, normal forms, closure ni transformaciones.

El selector ofrece además `Start from scratch` como opción `blank`, que genera
un draft vacío mediante `createInitialWorkspaceState`, no como quinto fixture
precargado. El valor inicial de cada entrada a Demo es `basic-normalization`.

## 7. Demo entry

Entrar directamente a Demo crea una instancia temporal, etiqueta el contexto
como `Demo` y muestra un aviso breve, no modal: “Changes in Demo stay only in
this tab and are discarded when you refresh or leave.” El selector compacto
vive en el toolbar de Schema junto al input existente; no se agrega landing,
wizard, onboarding obligatorio, dashboard ni navegación principal nueva.

La cabecera global, wordmark, footer Pampa Software, sistema visual, superficies
educativas y estructura responsive existentes se preservan. El título de
documento recomendado es `SchemaWise Demo — SchemaWise`; `/` y proyectos
mantienen sus títulos actuales.

## 8. Navigation

Cambiar sólo `?view=` es navegación intrarrecurso: actualiza la URL, conserva
draft, fixture, Closure y resultados, no hace requests y no pide confirmación.
El enlace Schema/Analysis/Transform usa exactamente el contrato de
`WorkspaceViewProvider` actual.

Salir a `/`, a un proyecto, mediante wordmark, enlace, Back o Forward es un
cambio de `DEMO WORKSPACE` a otra identidad. Un `DemoNavigationCoordinator`
mínimo y sin APIs de proyecto usa el `useBlocker` estable de React Router:

- Demo limpio: permite la transición.
- Demo dirty: muestra la confirmación accesible “Leaving Demo will discard your
  local changes.”; Stay restablece la navegación y el foco; Discard and
  continue procede una sola vez.
- No intercepta cambios `?view=` dentro de Demo.
- Registra `beforeunload` sólo cuando Demo está dirty; el texto del diálogo de
  navegador queda a cargo del navegador.

No se reutiliza `ProjectNavigationCoordinator` para Demo: sus intentos de
adopción, detach y root transition son específicos de recursos persistidos.

## 9. State lifecycle

| Evento | Draft/baseline | Recursos matemáticos | Navegación/capacidades |
| --- | --- | --- | --- |
| Entrada o refresh | Basic clonado; baseline Basic | Todos idle | Demo, sin Auth/Projects |
| Elegir blank o fixture limpio | Draft clonado; baseline igual al elegido | Abort en vuelo; `replaceDraft`; todos idle | Misma URL/superficie |
| Editar | Cambia draft; baseline sin cambio | Reducer conserva snapshots y marca stale | `dirty=true` |
| Analyze | No cambia baseline | Un POST `/analysis`; éxito va a Analysis | `dirty` sin cambio |
| Closure / 3NF / BCNF / preservation | No cambia draft/baseline | Un POST real por operación | `dirty` sin cambio |
| Selección confirmada de otro ejemplo | Reemplaza draft y baseline | Aborta y limpia recursos | Sigue Demo |
| Cancelar selector | Sin cambio | Sin cambio | Foco vuelve al selector |
| Salida limpia | Instancia se desmonta | Abort y descarte | Destino normal |
| Salida dirty confirmada | Instancia se desmonta tras commit | Abort y descarte | Destino normal |

El host debe abortar las cinco solicitudes tanto al reemplazar fixture como al
desmontar. El reducer ya ignora respuestas que no coinciden con el request ID;
la implementación debe mantener ese doble resguardo.

## 10. Dirty and stale behavior

`dirty` Demo compara únicamente el draft actual contra el baseline clonado del
fixture seleccionado o blank. No incluye selector abierto, vista, foco,
requests, Analysis, Closure, transformaciones ni resultados. Al editar y luego
restaurar exactamente el baseline, vuelve a limpio.

`stale` sigue siendo exclusivamente una propiedad matemática del reducer: una
edición posterior a Analyze conserva el snapshot histórico, sus etiquetas,
Analysis, Closure y transformaciones existentes como `Out of date`; bloquea
nuevas transformaciones basadas en ese snapshot hasta Analyze otra vez. Stale no
implica dirty ni persistence. Un nuevo Analyze exitoso hace Current y limpia
los recursos de transformación de la revisión previa, como hoy.

## 11. Example replacement

Seleccionar una opción distinta:

- si `dirty=false`, reemplaza de inmediato, incluso si hay resultados;
- si `dirty=true`, abre confirmación inline: “Changing the example will replace
  your current schema and discard local changes.”;
- Cancel conserva absolutamente todo; Confirm aborta operaciones, instala un
  clon del nuevo input, establece el nuevo baseline y limpia resultados;
- volver a elegir la misma opción no hace dispatch, request ni confirmación.

La condición es cambios del draft, no existencia de resultados. Así alguien
puede recorrer varios ejemplos analizados sin confirmaciones redundantes, pero
nunca pierde una edición local sin decisión explícita.

## 12. Refresh and exit

Refresh es deliberadamente efímero: vuelve a inicializar Basic, Schema,
resultados idle y `dirty=false`; no hace auth ni project requests. El navegador
puede advertir antes de refresh si hay draft dirty, pero no se intenta recuperar
su contenido después.

Salir limpio descarta la sesión Demo. Salir dirty requiere el blocker; al
confirmar no se serializa ni conserva nada. Si luego Back/Forward vuelve a una
entrada Demo previamente descartada, React monta una nueva instancia con Basic:
no se revive el reducer, draft, snapshot, selector ni resultados descartados.
Esta propiedad se verifica con una prueba POP real, no con una suposición sobre
el caché del navegador.

## 13. Mathematical API

Demo usa el mismo `SchemaWiseApi` real y los mismos DTOs que el producto:

| Acción | Endpoint | Input |
| --- | --- | --- |
| Analyze | `POST /api/v1/analysis` | snapshot del draft |
| Attribute closure | `POST /api/v1/closure` | snapshot + conjunto seleccionado |
| 3NF synthesis | `POST /api/v1/synthesis/3nf` | snapshot analizado |
| BCNF decomposition | `POST /api/v1/decomposition/bcnf` | snapshot analizado |
| Dependency preservation | `POST /api/v1/analysis/dependency-preservation` | snapshot analizado + descomposición BCNF |

No se precalcula, simula ni memoiza un resultado de fixture. Entrada, cambio de
vista, abrir contenido educativo, selector y stale no hacen requests. Una
activación aceptada genera exactamente una solicitud de su operación; mientras
esa operación esté `loading`, su control queda deshabilitado para impedir un
segundo POST accidental. Reintentar después de éxito/error es una nueva
activación y una nueva solicitud. El API no recibe credenciales ni CSRF desde
`schemawiseApi` actual.

## 14. Analysis and Transform

Schema → Analysis → Transform, Closure y el contenido educativo se reutilizan
sin versiones Demo. Direct links a Analysis/Transform no calculan: presentan el
empty state común hasta que el usuario analiza. Los resultados son del snapshot
capturado en inicio de la operación, no del draft vivo. La raíz de Analyze
puede cambiar a Analysis sólo tras éxito; un error deja el draft y cualquier
resultado histórico disponibles de acuerdo con el reducer actual.

## 15. Accessibility

El selector es un `<label>` + `<select>` (o control equivalente nativo) con
nombre accesible, opciones explícitas y confirmación inline `role=alert` con
foco inicial definido. No se reemplazan los controles nativos de editor,
checkboxes, disclosures, botones, live regions ni headings de las superficies.

El blocker de salida conserva el patrón accesible existente: heading enfocable,
mensaje inequívoco, Stay/Discard operables por teclado y restauración de foco al
origen al cancelar. Los cambios de superficie mantienen un único `aria-current`
y el foco de heading actual. La etiqueta temporal no debe depender sólo del
color; texto “Demo” y “Temporary” son visibles/legibles.

## 16. Responsive

El selector se integra en `.editor-toolbar`: en el breakpoint móvil existente
se apila o envuelve sin desplazar el botón Analyze, la navegación de superficies
ni el footer. No se añade una barra global. Se prueban 320, 360, 390, 768 y
1280 px, con los seis atributos Enrollment y las tres superficies completas;
el criterio es `scrollWidth <= innerWidth`, controles alcanzables y orden de
lectura coherente.

## 17. Security boundaries

La frontera Demo es de **capacidad de cliente**, no un cambio de seguridad de
servidor. La UI no tiene las referencias para auth o Projects; el backend sigue
aplicando autenticación, ownership, CSRF y validación a sus endpoints. No se
bloquean endpoints globalmente porque el workspace normal debe seguir
funcionando. Los endpoints matemáticos públicos siguen usando sus validaciones,
límites y errores contractuales reales. La ausencia de persistencia no convierte
la URL Demo en un canal de datos: schemas, IDs de usuario, tokens y resultados
no se codifican en URL ni storage.

## 18. Test strategy

La estrategia completa y sus casos está en
[demo-mode-test-plan.md](../testing/demo-mode-test-plan.md). Los gates centrales
son pruebas unitarias del fixture/dirty/identidad, integración con router y
mocks de red que rechazan Auth/Projects, y navegador para POP, refresh,
accesibilidad y responsive. Cada operación matemática se prueba contra la API
real local o un spy que verifica endpoint y DTO; los fixtures jamás sustituyen
la respuesta del motor.

## 19. Project Recovery regression

El principal riesgo no está en los cálculos sino en reordenar el árbol de
providers. Deben continuar las garantías congeladas de v1.2:

- `/` y `/projects/:id` siguen montando Auth una vez y preservan su contrato.
- save-new adopta el POST sin GET redundante; Save existente conserva URL y
  revisión; Open/direct/Back/Forward hidratan sólo por `ProjectRoute`.
- dirty blocker de Projects, detach por DELETE/404, OCC reload, reconnect limpio
  y dirty reconnect siguen con los mismos conteos de request.
- Demo no debe contaminar `workspaceResourceIdentity`, adopción efímera,
  `location.state`, dirty de proyecto, título o draft del recurso normal.

La suite existente `project-route.test.tsx`, `project-workflows.test.tsx` y
`workspace-view-navigation.test.tsx` es regresión obligatoria, complementada
por los casos Demo de aislamiento y salida.

## 20. Risks and trade-offs

| Riesgo | Mitigación/decisión |
| --- | --- |
| Ocultar controles pero dejar Auth montado | Ruta hermana fuera de `AuthProvider`; prueba de cero `/auth/*`. |
| Reutilizar host Project y filtrar botones | Rechazado: conservaría APIs, session y efectos fuera de alcance. |
| Duplicar reducer para Demo | Rechazado: divergirían stale, aborts y resultados educativos. |
| Extraer demasiado durante el cambio | Tranches pequeños, tests de Recovery antes/después; núcleo primero, UI después. |
| POP que revive estado descartado | Desmontaje de instancia, no history/state/storage; prueba Back/Forward. |
| IDs alteran resultado BCNF Enrollment | IDs `d,c,a,b,e,f` congelados y regresión de resultados reales. |
| Doble click genera POSTs | Deshabilitar operación propia mientras loading y contar requests. |
| Mensaje de refresh inconsistente entre navegadores | `beforeunload` es última barrera; el contrato no depende de su copy. |

## 21. Files to modify

Lista prevista para la fase de implementación, no modificada por esta propuesta:

- `apps/web/src/App.tsx` — árbol de rutas separado para Demo y producto.
- `apps/web/src/features/projects/workspace-resource-identity.ts` — identidad
  `DEMO WORKSPACE`, sin cambiar root/project.
- `apps/web/src/features/workspace/components/SchemaWorkspace.tsx` y
  `WorkspacePage.tsx` — extracción host/núcleo con capacidades discriminadas.
- Nuevos `apps/web/src/features/demo/` para `DemoRoute`, host, navegación,
  fixtures y pruebas; sin APIs Auth/Project.
- `apps/web/src/features/workspace/components/TransformSurface.tsx`,
  `ClosureTool.tsx` y botón Analyze si fuera necesario — guardia loading por
  operación, cubierta como comportamiento común.
- `apps/web/src/styles.css` — sólo estilos compactos/response del selector y
  contexto Demo.
- Pruebas de App, routes, workspace, demo y regresiones de Projects indicadas
  en el plan.
- `docs/README.md` sólo si su índice enumera documentos frontend nuevos.

No deben cambiarse `apps/api`, migraciones, contratos HTTP, Neon, configuración
de Auth, proxy ni `vercel.json`: su catch-all existente ya sirve `/demo`.

## 22. Recommended tranches

1. **Contrato y núcleo:** añadir fixtures/identidad/tests unitarios; extraer el
   núcleo `SharedWorkspaceCore` sin cambiar comportamiento de `/`/projects; pasar
   la regresión completa de Project Recovery.
2. **Ruta aislada:** declarar `/demo` fuera de Auth, crear host/capacidad Demo,
   selector/baseline y bloqueo temporal; probar cero Auth/Projects y estados.
3. **Operación y UX:** guardias loading, títulos, foco, CSS responsive,
   accesibilidad y request counts contra API real local.
4. **Gate final:** build, typecheck, suite completa, navegador POP/refresh,
   axe y viewport; sólo entonces revisión humana para decidir implementación
   terminada. No hay deploy en este alcance.

## 23. Documentation

Esta propuesta se acompaña de:

- [demo-mode-contracts.md](./demo-mode-contracts.md): contratos de tipos,
  estado y transición.
- [demo-mode-test-plan.md](../testing/demo-mode-test-plan.md): matriz
  verificable de QA y regresión.

## 24. Git status

Al comienzo de la auditoría el worktree estaba limpio en `master` (HEAD
`bac5f9d`). Esta fase sólo añade los tres documentos solicitados; no hay cambios
de aplicación, commit, push ni deploy.

## 25. Final recommendation

Proceder sólo con una Demo como recurso `DEMO WORKSPACE` y una ruta hermana
fuera de Auth. La reutilización correcta es el núcleo `SharedWorkspaceCore` con su
único reducer por instancia y sus operaciones reales; reutilizar el host de
proyectos sería un fallo de aislamiento. La propuesta mantiene la experiencia
educativa y reduce el riesgo de Project Recovery a una regresión explícita y
medible.

## 26. Next step

Revisar y aprobar esta arquitectura definitiva —en especial la separación del
árbol de providers, el baseline de dirty y el comportamiento POP/refresh— antes
de modificar código.

## 27. Cierre de Tranche 4

La auditoría final confirmó una sola implementación matemática por instancia:
`useSharedWorkspaceCore` posee el único reducer; Demo no crea motor, reducer ni
snapshot paralelo. `/demo` sigue fuera de Auth y Projects aun con sesión previa.

Se corrigió una carrera real: una promesa que resolvía tras abortar/reemplazar
podía ejecutar el callback de navegación aunque el reducer descartase sus datos.
Ahora cada respuesta requiere seguir siendo propietaria de su controlador activo
antes de despachar o ejecutar callbacks. Demo también evita activaciones
duplicadas sin alterar el reintento explícito de Projects.

La evidencia completa está en [demo-mode-v1-audit.md](../testing/demo-mode-v1-audit.md).
