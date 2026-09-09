# HTTP adapter v1

SchemaWise usa Fastify como adapter HTTP delgado: recibe JSON, aplica las
reglas de transporte y delega cada operación a Application Layer. Los handlers
no construyen objetos de dominio ni ejecutan algoritmos del Normalization
Engine.

`createServer()` construye una instancia Fastify sin abrir un puerto. `startServer()`
es el entrypoint de proceso; usa `PORT` (default `3000`) y `HOST` (default
`0.0.0.0`). La importación del módulo no inicia el servidor.

Las rutas son `POST /api/v1/analysis`, `POST /api/v1/closure`,
`POST /api/v1/synthesis/3nf`, `POST /api/v1/decomposition/bcnf` y
`POST /api/v1/analysis/dependency-preservation`. Todas aceptan
`application/json` y devuelven `200` en éxito.

Fastify aplica un `bodyLimit` real de 64 KiB. Media types no soportados devuelven
`415`; JSON inválido, rutas desconocidas y errores de input usan el envelope v1.
Los límites semánticos usan `422 ANALYSIS_LIMIT_EXCEEDED`, payload excesivo usa
`413 ANALYSIS_LIMIT_EXCEEDED`, y errores inesperados usan `500 INTERNAL_ERROR`.
No se exponen stacks, causes ni mensajes internos.

No hay falsa preemption: el adapter no usa `Promise.race`, timers,
`AbortController`, workers ni produce `OPERATION_TIMEOUT`. La protección v1
depende de límites de input; la ejecución CPU-bound permanece síncrona.

Los tests usan `fastify.inject()`, sin puertos reales. La factory acepta overrides
de use cases únicamente para probar el mapping de errores inesperados.
