# HTTP adapter v1

SchemaWise usa Fastify como adapter HTTP delgado: recibe JSON, aplica las
reglas de transporte y delega cada operación a Application Layer. Los handlers
no construyen objetos de dominio ni ejecutan algoritmos del Normalization
Engine.

`createServer()` construye una instancia Fastify sin abrir un puerto. `startServer()`
es el entrypoint de proceso; usa `PORT` (default `3000`) y `HOST` (default
`0.0.0.0`). La importación del módulo no inicia el servidor.

CORS es responsabilidad de este HTTP Adapter y se implementa con
`@fastify/cors`. `CORS_ORIGINS` configura una allowlist separada por comas.
Cuando no se define, el default local limitado permite `localhost` y
`127.0.0.1` en los puertos Vite `5173` y `5174`. En producción se debe definir
explícitamente la allowlist de origins; no se usa wildcard. Sólo se permiten
`GET`, `POST`, `PUT`, `DELETE` y `OPTIONS`; los headers permitidos son `Content-Type` y
`X-CSRF-Token`. Las credenciales están habilitadas (`credentials: true`).

El preflight `OPTIONS` es atendido por el plugin antes de las rutas y no entra
en Application Layer. Un origin no autorizado no recibe headers CORS válidos;
la request HTTP puede continuar y producir su respuesta normal, pero el
navegador bloquea el acceso a esa respuesta.

Las rutas son `POST /api/v1/analysis`, `POST /api/v1/closure`,
`POST /api/v1/synthesis/3nf`, `POST /api/v1/decomposition/bcnf` y
`POST /api/v1/analysis/dependency-preservation`. Todas aceptan
`application/json` y devuelven `200` en éxito.

Project HTTP añade `POST/GET /api/v1/projects` y `GET/PUT/DELETE
/api/v1/projects/:projectId`. Las cinco rutas requieren sesión. Las tres
mutaciones validan provenance y el CSRF ligado a la sesión antes de interpretar
el DTO o tocar el repositorio. List/detail no exigen CSRF. Los handlers sólo
pasan `AuthContext.userId` a los casos de uso; nunca leen o derivan cookies por
su cuenta. Los mappers eliminan `ownerId`, convierten timestamps a ISO 8601 y no
incluyen el schema completo en listados.

Fastify aplica un `bodyLimit` real de 64 KiB, también para `POST`/`PUT` de
Projects. Media types no soportados devuelven
`415`; JSON inválido, rutas desconocidas y errores de input usan el envelope v1.
Los límites semánticos usan `422 ANALYSIS_LIMIT_EXCEEDED`, payload excesivo usa
`413 ANALYSIS_LIMIT_EXCEEDED`, y errores inesperados usan `500 INTERNAL_ERROR`.
No se exponen stacks, causes ni mensajes internos.

No hay falsa preemption: el adapter no usa `Promise.race`, timers,
`AbortController`, workers ni produce `OPERATION_TIMEOUT`. La protección v1
depende de límites de input; la ejecución CPU-bound permanece síncrona.

Los tests generales usan `fastify.inject()`. La integración de seguridad Auth y
Projects abre además un puerto TCP efímero y usa `fetch` contra PostgreSQL real.
La factory acepta overrides de use cases, configuración Auth, repositorio de
Projects, secreto CSRF, origins, límites y trust proxy para pruebas
determinísticas.

`TRUST_PROXY` sólo acepta `true` o `false` y por defecto es `false`; no se confía
en `X-Forwarded-For` sin decisión explícita de despliegue. Los límites Auth son
específicos de ruta y usan memoria local del proceso, no un límite global de la
API.
