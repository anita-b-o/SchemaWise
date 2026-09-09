import type { FastifyInstance } from "fastify";
import { authError, isAuthApplicationError } from "../auth/errors/auth-error.js";
import type { AuthRuntime } from "../auth/runtime/auth-runtime.js";
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
  type AuthCookieConfig,
} from "./auth-cookie.js";
import { resolveAuthenticatedUser } from "./auth-context.js";

interface AuthRequestDto {
  readonly email: unknown;
  readonly password: unknown;
}

function readAuthRequestDto(body: unknown): AuthRequestDto {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw authError("INVALID_AUTH_REQUEST", "The authentication request is invalid.");
  }
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2 || !Object.hasOwn(record, "email") || !Object.hasOwn(record, "password")) {
    throw authError("INVALID_AUTH_REQUEST", "The authentication request is invalid.");
  }
  return { email: record.email, password: record.password };
}

export function registerAuthRoutes(
  server: FastifyInstance,
  auth: AuthRuntime,
  cookieConfig: AuthCookieConfig,
): void {
  server.post("/api/v1/auth/register", async (request, reply) => {
    const result = await auth.register(readAuthRequestDto(request.body));
    setSessionCookie(reply, result.session.token, result.session.expiresAt, cookieConfig);
    return reply.code(201).send({ user: result.user });
  });

  server.post("/api/v1/auth/login", async (request, reply) => {
    const result = await auth.login(readAuthRequestDto(request.body));
    setSessionCookie(reply, result.session.token, result.session.expiresAt, cookieConfig);
    return reply.code(200).send({ user: result.user });
  });

  server.get("/api/v1/auth/me", async (request, reply) => {
    const rawToken = readSessionToken(request);
    try {
      const context = await resolveAuthenticatedUser(request, auth);
      return reply.code(200).send({ user: context.user });
    } catch (error) {
      if (rawToken !== undefined && isAuthApplicationError(error) && error.code === "UNAUTHENTICATED") {
        clearSessionCookie(reply, cookieConfig);
      }
      throw error;
    }
  });

  server.post("/api/v1/auth/logout", async (request, reply) => {
    try {
      await auth.logout(readSessionToken(request));
    } finally {
      clearSessionCookie(reply, cookieConfig);
    }
    return reply.code(204).send();
  });
}
