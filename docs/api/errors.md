# Errores del API v1

## Envelope

Toda respuesta de error usa una forma estable:

```json
{
  "error": {
    "code": "ATTRIBUTE_IDENTITY_COLLISION",
    "message": "Two attributes use the same id with different names.",
    "details": {
      "attributeId": "a"
    }
  }
}
```

- `code` es estable, legible por máquinas y forma parte del contrato v1.
- `message` es una descripción humana diagnóstica. Puede mejorar sin cambio de
  versión y la UI no debe analizarla ni usarla como clave de traducción.
- `details` es opcional, estructurado y específico del código. No contiene stack
  traces, nombres de clases internas, rutas del servidor ni datos sensibles.

## Códigos mínimos

| Código | HTTP | Uso |
| --- | --- | --- |
| `INVALID_REQUEST` | 400 o 415 | JSON malformado, media type incorrecto o forma/tipos del DTO inválidos. |
| `INVALID_RELATION` | 400 | Nombre inválido, cero atributos u otra regla de la relación. |
| `INVALID_ATTRIBUTE` | 400 | ID/nombre inválido o ID duplicado con el mismo nombre. |
| `ATTRIBUTE_IDENTITY_COLLISION` | 400 | El mismo ID aparece asociado a nombres distintos. |
| `UNKNOWN_ATTRIBUTE_REFERENCE` | 400 | Una FD, conjunto solicitado o descomposición referencia un ID no declarado. |
| `INVALID_FUNCTIONAL_DEPENDENCY` | 400 | La FD no cumple su estructura; lados vacíos por sí solos sí son válidos. |
| `SCHEMA_SCOPE_VIOLATION` | 400 | Una subrelación o conjunto está fuera del scope de la relación. |
| `INCOMPLETE_DECOMPOSITION` | 400 | La unión de subrelaciones no cubre la relación original. |
| `ANALYSIS_LIMIT_EXCEEDED` | 422 | El documento es matemáticamente expresable pero supera un límite de producto. |
| `OPERATION_TIMEOUT` | pending | El cálculo excedió un presupuesto de runtime; el mapping HTTP depende del mecanismo de ejecución. |
| `INTERNAL_ERROR` | 500 | Falló una invariante interna o ocurrió un defecto no clasificable. |

`UNKNOWN_ATTRIBUTE_REFERENCE` se usa al resolver IDs antes de construir objetos
de dominio. `SCHEMA_SCOPE_VIOLATION` queda para conjuntos o subrelaciones ya
resueltos que no pertenecen al esquema permitido. Esta distinción conserva
utilidad para la UI sin crear códigos por endpoint.

La forma o tipos inválidos y el JSON malformado usan `400 Bad Request`. Un
`Content-Type` no soportado usa `415 Unsupported Media Type`; ambos comparten
`INVALID_REQUEST` porque la UI aplica la misma corrección: enviar el documento
JSON conforme al contrato.

Un payload que supera el límite de bytes se rechaza con `413 Payload Too Large`
y `ANALYSIS_LIMIT_EXCEEDED`: el servidor puede decidirlo antes de parsear el
JSON, por lo que `details` podría incluir sólo `maxPayloadBytes`. Los límites de
cardinalidad o longitud usan `422` y el mismo código, con el nombre del límite.

`408 Request Timeout` no se usa para tiempo de CPU: describe un timeout al
recibir la solicitud. `504` queda reservado para un gateway. Un timer del mismo
event loop no puede preemptar un cálculo CPU-bound; por eso el status de
`OPERATION_TIMEOUT` queda pendiente de runtime. Los límites detectados antes de
ejecutar conservan `413`/`422` y `ANALYSIS_LIMIT_EXCEEDED`.

## Ejemplo: colisión de identidad

Request parcial inválido:

```json
{
  "relation": {
    "name": "R",
    "attributes": [
      { "id": "a", "name": "Account" },
      { "id": "a", "name": "Amount" }
    ]
  },
  "functionalDependencies": []
}
```

Response `400 Bad Request`:

```json
{
  "error": {
    "code": "ATTRIBUTE_IDENTITY_COLLISION",
    "message": "Two attributes use the same id with different names.",
    "details": {
      "attributeId": "a"
    }
  }
}
```

## Traducción de errores internos

La capa Application/API valida DTOs y scope de forma explícita, por lo que los
errores esperables se asignan sin depender del texto de excepciones del engine.
Si aun así el engine rechaza una entrada por una invariante conocida, un adapter
cerrado la traduce a un código público; no reenvía literalmente `Error.message`.
Cualquier excepción desconocida se registra internamente con un identificador
de correlación futuro y se devuelve como `INTERNAL_ERROR`, sin stack trace.
