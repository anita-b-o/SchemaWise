# SchemaWise Demo v1 — contratos formales

Estado: **TRANCHE 2 IMPLEMENTADO — contratos de ejemplos pendientes (Tranche 3)**

Documento complementario de `demo-mode-v1.md`.

## Contrato vigente en Tranche 2

La ruta exacta `/demo` monta `DemoWorkspaceHost` fuera de `AuthProvider` y
`ProjectRoute`. `workspaceResourceIdentity("/demo")` devuelve
`DEMO WORKSPACE`; `view` no altera esa identidad. El host sólo entrega
`SchemaWiseApi` al núcleo compartido y no acepta `ProjectApi`, sesión, CSRF,
`projectId`, revisión ni callbacks Save/Open/New/Delete. El draft inicial y el
baseline dirty son ambos vacíos. Dirty se define por relación no vacía, algún
atributo o alguna dependencia. Las superficies y resultados viven sólo en la
instancia React; refresh y reentrada crean instancias nuevas. La navegación
entre superficies conserva la misma instancia y no calcula. La salida dirty
usa `useBlocker` y `beforeunload`; Stay devuelve foco al enlace de salida.

Los contratos de selección, fixtures y reemplazo de más abajo son el diseño de
**Tranche 3**. No se implementaron en Tranche 2 y sus referencias a Basic como
draft inicial no se aplican aún.

## Invariantes

1. Una instancia Demo tiene exactamente un `workspaceReducer` y nunca un
   `ProjectSession`.
2. Una instancia Demo no monta `AuthProvider` ni `ProjectRoute`.
3. Ninguna transición Demo emite Auth/Projects; sólo las cinco operaciones
   matemáticas autorizadas pueden hacer red.
4. Fixtures son input inmutable; todos los resultados proceden del API real.
5. Una URL no representa ni transporta el draft, resultados, ID de usuario,
   CSRF, fixture completo o estado histórico.
6. `DEMO WORKSPACE` es distinto de `ROOT WORKSPACE` y `PROJECT:<id>`.
7. Stale es histórico/matemático; dirty es local/de salida. No son sinónimos.

## Contrato de capacidades

### Interfaz implementada en Tranche 1

El límite real está en `features/workspace/shared-workspace-core.ts`. No importa
Auth, Projects, rutas ni persistencia:

```ts
interface SharedWorkspaceCoreOptions {
  api?: SchemaWiseApi;
  initialDraft?: SchemaDraft;
  onAnalyzeSuccess?: () => void;
  onInvalidAnalysis?: (issue: ValidationIssue) => void;
}

interface SharedWorkspaceCore {
  state: WorkspaceState;
  issues: readonly ValidationIssue[];
  dispatch(action: WorkspaceAction): void;
  replaceDraft(draft: SchemaDraft): void;
  resetWorkspace(): void;
  abortOperations(): void;
  calculateClosure(attributes: readonly string[]): Promise<void>;
  analyze(): Promise<void>;
  generateSynthesis(): Promise<void>;
  generateBcnf(): Promise<void>;
  checkDependencyPreservation(): Promise<void>;
}
```

`ProjectWorkspaceHost` consume esa interfaz y conserva explícitamente Auth,
`ProjectApi`, sesión, Save/Open/New/Delete, Recovery y OCC. `SchemaWorkspace`
queda sólo como alias de compatibilidad de pruebas. La variante discriminada
de Demo con `fixtureId` sigue propuesta para Tranche 3. La ruta y el host Demo
ya existen; el selector y los fixtures no.

`WorkspaceSurfaces` recibe el núcleo, la vista actual y callbacks mínimos de
chrome (navegación/foco y confirmación de ejemplo). Es la única composición de
Schema, Analysis y Transform; por tanto un host futuro no deberá copiar
componentes educativos, visualizaciones ni estado de transformaciones.

El diseño objetivo es un discriminante exhaustivo. Pseudotipos descriptivos:

```ts
type WorkspaceResource =
  | { kind: "root"; identity: "ROOT WORKSPACE" }
  | { kind: "project"; identity: `PROJECT:${string}`; projectId: string }
  | { kind: "demo"; identity: "DEMO WORKSPACE"; fixtureId: DemoSelection };

type WorkspaceHost =
  | { mode: "project"; /* capacidades de Auth/Project explícitas */ }
  | {
      mode: "demo";
      resource: Extract<WorkspaceResource, { kind: "demo" }>;
      baselineDraft: SchemaDraft;
      onRequestSelection(selection: DemoSelection): void;
      onDirtyChange(dirty: boolean): void;
    };
```

La rama `demo` no expone `projectsApi`, nombre de proyecto, CSRF, usuario,
`initialProject`, adopción, reload, Save/Open/New/Delete ni mutaciones de
persistencia. El núcleo puede recibir `SchemaWiseApi`, puesto que ésa es una
capacidad matemática común y pública.

Los nombres concretos pueden ajustarse al refactor, pero no el discriminante ni
la ausencia tipada de capacidad de persistencia.

## Selección y fixtures

```text
DemoSelection = blank
              | basic-normalization
              | composite-key
              | third-normal-form-vs-bcnf
              | enrollment
```

El módulo de fixture publica un mapa readonly y `draftFor(selection)` que
siempre devuelve un clon. `blank` devuelve el draft vacío canónico. La opción
inicial en montaje es `basic-normalization`; no se deduce de search params.

La identidad de recurso siempre es `DEMO WORKSPACE`, incluso al pasar de Basic
a Enrollment. `fixtureId` sirve para UI/baseline y no para bloquear navegación.

## Modelo de estado Demo

```text
DemoState (host)
  selection: DemoSelection
  baseline: SchemaDraft                 // clon semántico del selection
  pendingSelection?: DemoSelection
  confirmation?: replace-example | leave-demo

SharedWorkspaceCore (núcleo)
  WorkspaceState                         // reducer existente, única fuente de
                                         // draft/revision/snapshots/requests
```

`dirtyDemo = !semanticEqual(state.draft, baseline)`. La igualdad compara nombre
de relación, orden/IDs/nombres de atributos y lados/orden de FDs; no usa
`revision`, request ID, resultados, UI o referencia de objeto. Usar una copia
normalizada o comparación estructural explícita evita que el baseline pueda
mutarse.

`outOfDate` sigue proveniendo del reducer:

```text
edición tras análisis -> analysis.outOfDate = true
edición tras closure  -> closure.outOfDate = true
análisis exitoso nuevo -> analysis current; transformaciones previas idle
replace fixture/blank -> estado inicial; nada histórico queda visible
```

## Tabla de transición

| Estado/evento | Guarda | Acción | Estado resultante |
| --- | --- | --- | --- |
| `mounted` | — | `draftFor(basic)` + estado inicial | `selection=basic`, limpio, Schema por URL |
| `select(X)` | `X === selection` | no-op | sin cambio |
| `select(X)` | no dirty | abortar operaciones; `replaceDraft(draftFor(X))`; baseline X | X, limpio, recursos idle |
| `select(X)` | dirty | registrar `pendingSelection=X` | confirmación replace |
| `cancelReplace` | confirmación replace | limpiar pending | sin cambio |
| `confirmReplace` | confirmación replace | misma acción que select limpio | X, limpio, recursos idle |
| `edit` | — | dispatch actual de draft | posiblemente dirty; historia stale conservada |
| `analyze` válido | no loading de Analysis | POST real y dispatch actual | loading; éxito navega Analysis |
| `operation` | no loading de esa operación y snapshot válido | un POST real y dispatch actual | recurso loading/success/error |
| `navigateView` | destino Demo | actualizar `view` | mismo host/reducer |
| `leave` | limpio | permitir | desmontaje/descarte |
| `leave` | dirty | bloquear | confirmación leave |
| `stay` | confirmación leave | reset blocker y foco | mismo host/reducer |
| `discardLeave` | confirmación leave | proceed una vez | desmontaje/descarte tras commit |
| `refresh` | — | nueva carga de documento | Basic limpio; resultados idle |

`replaceDraft` sólo se despacha después de la confirmación, nunca al abrir el
selector. Todo Abort ocurre antes del reemplazo y también en cleanup de
desmontaje. Respuestas tardías se ignoran por el request ID vigente del reducer.

## Operaciones y conteos

Cada handler usa un snapshot creado al activarse; no lee un draft posterior al
`await`. Los endpoint contracts son los existentes y no incluyen auth:

| Operación | Precondición | Request | Prevención de duplicado |
| --- | --- | --- | --- |
| Analyze | draft válido; Analysis no loading | `analyzeSchema(snapshot)` | botón disabled durante loading |
| Closure | draft válido; Closure no loading | `calculateClosure({...snapshot, attributes})` | botón disabled durante loading |
| 3NF | snapshot Analysis current; operación no loading | `synthesizeThirdNormalForm(snapshot)` | botón disabled durante loading |
| BCNF | snapshot Analysis current; operación no loading | `decomposeBoyceCodd(snapshot)` | botón disabled durante loading |
| Preservation | BCNF actual disponible; operación no loading | preservation con relaciones BCNF | botón disabled durante loading |

Abort por reemplazo/salida no es un resultado ni una reintento automático. Una
acción posterior explícita puede emitir una nueva solicitud.

## Navegación e historia

El coordinador Demo debe evaluar identidades, no strings de URL completos:

```text
/demo?view=schema ─┐
/demo?view=analysis├─ misma identidad: DEMO WORKSPACE, sin prompt
/demo?view=transform┘

/demo ─────→ / o /projects/:id: otra identidad; prompt sólo si dirty
```

Para POP bloqueado, `Stay` mantiene la entrada actual. `Discard and continue`
deja que React Router complete el POP original; no emite una navegación manual
alternativa. Una vez que el destino no Demo se compromete, el componente Demo
se desmonta y no deja memoria externa. Al avanzar de nuevo a una entrada Demo,
se crea la instancia inicial, por lo que no existe una ruta para restaurar un
estado descartado.

El coordinador Demo no conoce adopción de POST, detach de proyecto,
`rootTransitionKey`, `routeProjectId` ni hidratación. No altera títulos,
history.state o sesiones de Projects.

## Errores

Errores de `SchemaWiseApi` reutilizan las presentaciones actuales: red,
validación/límites y fallo inesperado muestran mensaje accesible sin exponer
detalles internos; el draft y un snapshot previo permanecen disponibles. Un
error no genera persistencia, login ni cambio de ruta. Error al cargar una
ruta inexistente sigue el not-found global; no hay un error de "Demo project".

## Contrato de no persistencia verificable

Durante `/demo` se prohíbe:

- llamadas con pathname `/api/v1/auth/` y `/api/v1/projects`;
- escribir/leer Web Storage o IndexedDB para Demo;
- enviar métodos `POST`, `PUT`, `PATCH` o `DELETE` a Projects;
- serializar el draft a query/hash/history state;
- invocar repositorios, Neon o código de persistencia.

Se permite exclusivamente POST a los cinco endpoints matemáticos cuando hay
una acción del usuario que cumple precondiciones.
