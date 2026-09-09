import type { FastifyError, FastifyInstance, FastifyRequest } from "fastify";
import { authInternalError, isAuthApplicationError } from "../auth/errors/auth-error.js";
import { isApplicationError, applicationError } from "../errors/application-error.js";
import { statusForApplicationError, statusForAuthError } from "./http-status.js";
import { isHttpSecurityError } from "./security-error.js";
import { isProjectApplicationError } from "../persistence/errors/project-error.js";
import { statusForProjectError } from "./http-status.js";

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
  server.setErrorHandler((error: FastifyError, request, reply) => {
    const isAuthRoute = request.url.startsWith("/api/v1/auth/");
    const isProjectRoute = request.url === "/api/v1/projects" || request.url.startsWith("/api/v1/projects?") || request.url.startsWith("/api/v1/projects/");
    if (isHttpSecurityError(error)) {
      return reply.code(403).send(envelope(error.code, error.message));
    }
    if (isAuthApplicationError(error)) {
      if (statusForAuthError(error.code) >= 500) logInternalError(request, error);
      return reply.code(statusForAuthError(error.code)).send(envelope(error.code, error.message, error.details));
    }
    if (isProjectApplicationError(error)) {
      if (statusForProjectError(error.code) >= 500) logInternalError(request, error);
      return reply.code(statusForProjectError(error.code)).send(envelope(error.code, error.message, error.details));
    }
    if (isApplicationError(error)) {
      if (statusForApplicationError(error.code) >= 500) logInternalError(request, error);
      return reply.code(statusForApplicationError(error.code)).send(envelope(error.code, error.message, error.details));
    }
    if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
      return reply.code(415).send(envelope("INVALID_REQUEST", "Content-Type must be application/json."));
    }
    if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      if (isAuthRoute) {
        return reply.code(400).send(envelope("INVALID_AUTH_REQUEST", "The authentication request is invalid."));
      }
      if (isProjectRoute) {
        return reply.code(413).send(envelope("PROJECT_LIMIT_EXCEEDED", "Request payload exceeds the maximum size.", { limit: "maxPayloadBytes", maximum: 64 * 1024 }));
      }
      return reply.code(413).send(envelope("ANALYSIS_LIMIT_EXCEEDED", "Request payload exceeds the maximum size.", { limit: "maxPayloadBytes", maximum: 64 * 1024 }));
    }
    if (error instanceof SyntaxError || error.code === "FST_ERR_CTP_INVALID_JSON_BODY") {
      if (isAuthRoute) {
        return reply.code(400).send(envelope("INVALID_AUTH_REQUEST", "The authentication request is invalid."));
      }
      return reply.code(400).send(envelope("INVALID_REQUEST", "Request body contains invalid JSON."));
    }
    if (isAuthRoute) {
      logInternalError(request, error);
      const internal = authInternalError();
      return reply.code(500).send(envelope(internal.code, internal.message));
    }
    if (isProjectRoute) {
      logInternalError(request, error);
      return reply.code(500).send(envelope("PERSISTENCE_ERROR", "The project persistence operation failed."));
    }
    logInternalError(request, error);
    const internal = applicationError("INTERNAL_ERROR", "The request could not be completed.");
    return reply.code(500).send(envelope(internal.code, internal.message));
  });
}

function logInternalError(request: FastifyRequest, error: FastifyError): void {
  request.log.error(
    {
      errorType: error.name,
      errorCode: typeof error.code === "string" ? error.code : undefined,
    },
    "Request failed with an internal error",
  );
}
