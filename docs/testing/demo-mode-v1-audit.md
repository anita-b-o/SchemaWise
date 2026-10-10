# SchemaWise Demo v1 — auditoría integral y release preparation

Fecha: 2026-10-10  
Resultado: **SCHEMAWISE DEMO V1: FROZEN**

## Alcance y arquitectura

El baseline fue `master` nueve commits adelante de `origin/master`, worktree
limpio. El diff de Tranches 1–3 se limita a `apps/web`, documentación y
lockfile; `git diff origin/master...HEAD -- apps/api packages` no devolvió
cambios. No se tocaron API, engine, migraciones, infraestructura, secretos,
Render, Neon ni Vercel.

- `/demo` es ruta hermana de producto: no monta `AuthProvider`, `ProjectRoute`
  ni `ProjectNavigationCoordinator`.
- Demo recibe sólo `SchemaWiseApi`; no recibe `ProjectApi`, `projectId`, CSRF,
  revisión, snapshot remoto, Save/Open/New/Delete/OCC ni persistencia.
- La identidad es `DEMO WORKSPACE`, distinta de root y `PROJECT:<uuid>`.
- `useSharedWorkspaceCore` mantiene el único `workspaceReducer`; no existe
  segundo motor ni estado matemático Demo.
- Fixtures tienen IDs deterministas, están congelados, se clonan y no incluyen
  resultados precalculados.

La integración en StrictMode cubre cero llamadas Auth y Project para `/demo`,
las deep links y path Demo desconocido. Chromium local observó cero endpoints
`/auth/*` y `/projects*`, incluso con API matemática real disponible.

## Lifecycle, navegación y concurrencia

`/demo` inicia Basic: `R(A,B,C)`, `A→B`, `B→C`, sin Analyze automático;
`view` desconocido normaliza a Schema. Analysis/Transform directos son empty
states. Navegación y Back/Forward preservan reducer y URL de superficie sin
red; refresh/reentrada crean Basic limpia y descartan resultados.

El selector no cambia el ejemplo activo. Reemplazo limpio es inmediato;
reemplazo dirty confirma `Keep working`/`Replace example`, preserva foco/URL al
cancelar y limpia baseline/recursos al confirmar. Dirty compara sólo draft con
baseline Demo; stale continúa ligado al snapshot analizado.

Se corrigió un hallazgo Medium: una promesa no cooperativa que resolvía tras
abort podía ejecutar `onAnalyzeSuccess` después de un replace. Ahora cada
respuesta debe mantener la propiedad de su `AbortController` antes de dispatch
o callback; `abortOperations` vacía los cinco canales. Nueva prueba prueba que
la respuesta tardía de A no afecta fixture B, URL ni foco. El guard cubre
Analysis, Closure, 3NF, BCNF y preservation. Demo deshabilita su operación
pendiente para no duplicar POSTs, sin cambiar los reintentos de Projects.

## Matemática, red y Project Recovery

Chromium local usó `createServer` con los use-cases matemáticos reales. Basic
mostró candidate keys y resultados 2NF/3NF/BCNF y completó 3NF, BCNF y
preservation. Cada activación produjo un POST (más OPTIONS CORS) a los
endpoints matemáticos, sin Auth/Projects. Las regresiones API/engine verifican:

- Basic: `{A}`, prime `{A}`, 2NF satisfecha, 3NF/BCNF violadas y dos FDs.
- Composite: `{A,B}` y dependencia parcial/violación 2NF.
- 3NF vs BCNF: claves múltiples y excepción de atributo primo sólo para 3NF.
- Enrollment (`d,c,a,b,e,f`): key `{Student, Course}`, 2NF/3NF/BCNF 3/44/44,
  cuatro relaciones 3NF/BCNF, tres pasos y pérdida `Department → Office`.

Project Recovery pasó íntegramente en Web: workflows (24), route (12) y view
navigation (20), junto a las suites de snapshots, closure y transformaciones.

## Browser, accesibilidad y responsive

| Estado Chromium | Violations axe | Incomplete axe |
| --- | ---: | --- |
| Schema inicial | 0 | `color-contrast` |
| Analysis Basic | 0 | `color-contrast` |
| Transform Basic | 0 | ninguna |
| Enrollment | 0 | ninguna |
| Analysis stale | 0 | ninguna |
| Confirmación de replace | 0 | `color-contrast` |
| Mobile | 0 | `color-contrast` |

Los incomplete de contraste se registran aparte y no se interpretan como PASS
automático. No hubo errores de página, warnings de consola, assets fallidos ni
promesas no manejadas en el flujo observado. Las confirmaciones tienen roles,
nombre y descripción; selector, navegación, foco, diagramas/notación y teclado
están cubiertos por componentes.

No hubo overflow horizontal en 320×720, 360×800, 390×844, 768×1024,
1024×768, 1280×800 y 1440×900 (0 en móvil; -15 px por scrollbar vertical en
desktop). Selector y footer permanecieron presentes.

## Validaciones, hallazgos y release

- `npm run typecheck`: PASS.
- `npm test`: PASS — API 142, Web 237, engine 173; total **552**.
- `npm run build`: PASS.
- `npm run test --workspace @schemawise/web`: PASS — 237.
- `git diff --check`: PASS.
- `npm audit --omit=dev`: PASS — 0 vulnerabilidades.

| Severidad | Hallazgo | Estado |
| --- | --- | --- |
| Medium | Callback tardío podía navegar tras replace. | Corregido y probado. |
| Medium | Demo admitía activación repetida en loading. | Corregido y probado. |
| Low | Confirmaciones sin descripción explícita. | Corregido. |

No quedan Critical, High ni Medium abiertos. No se hizo push/deploy. La única
verificación diferida es repetir la auditoría visual/axe en `/demo` pública
después del deploy autorizado.

Plan autorizado posteriormente: push de todos los commits, GitHub CI,
auto-deploy Vercel y auditoría pública. No redeploy de Render sin diff backend,
no cambios Neon, tag ni promoción comercial.
