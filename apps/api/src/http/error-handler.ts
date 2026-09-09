import type { FastifyError, FastifyInstance } from "fastify";
import { isApplicationError, applicationError } from "../errors/application-error.js";
import { statusForApplicationError } from "./http-status.js";

interface ErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
}

function envelope(code: string, message: string, details?: Readonly<Record<string, unknown>>): ErrorEnvelope {
  return details === undefined ? { error: { code, message } } : { error: { code, message, details } };
}

export function registerErrorHandler(server: FastifyInstance): void {
  server.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send(envelope("INVALID_REQUEST", "The requested API route does not exist."));
  });
  server.setErrorHandler((error: FastifyError, _request, reply) => {
    if (isApplicationError(error)) {
      return reply.code(statusForApplicationError(error.code)).send(envelope(error.code, error.message, error.details));
    }
    if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
      return reply.code(415).send(envelope("INVALID_REQUEST", "Content-Type must be application/json."));
    }
    if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return reply.code(413).send(envelope("ANALYSIS_LIMIT_EXCEEDED", "Request payload exceeds the maximum size.", { limit: "maxPayloadBytes", maximum: 64 * 1024 }));
    }
    if (error instanceof SyntaxError || error.code === "FST_ERR_CTP_INVALID_JSON_BODY") {
      return reply.code(400).send(envelope("INVALID_REQUEST", "Request body contains invalid JSON."));
    }
    const internal = applicationError("INTERNAL_ERROR", "The request could not be completed.");
    return reply.code(500).send(envelope(internal.code, internal.message));
  });
}
