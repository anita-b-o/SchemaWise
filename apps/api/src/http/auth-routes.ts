import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { authError, isAuthApplicationError } from "../auth/errors/auth-error.js";
import type { AuthRuntime } from "../auth/runtime/auth-runtime.js";
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
  type AuthCookieConfig,
} from "./auth-cookie.js";
import { resolveAuthenticatedUser } from "./auth-context.js";
import {
  assertAllowedRequestOrigin,
  assertValidCsrfToken,
  deriveCsrfToken,
  loginEmailIpRateLimitKey,
  type AuthRateLimitConfig,
} from "./auth-security.js";

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
  csrfSecret: string,
  allowedOrigins: readonly string[],
  limits: AuthRateLimitConfig,
): void {
  server.register(async (authServer) => {
    await authServer.register(rateLimit, {
      global: false,
      addHeadersOnExceeding: {
        "x-ratelimit-limit": false,
        "x-ratelimit-remaining": false,
        "x-ratelimit-reset": false,
      },
      addHeaders: {
        "x-ratelimit-limit": false,
        "x-ratelimit-remaining": false,
        "x-ratelimit-reset": false,
        "retry-after": true,
      },
    });

    const requireOrigin = async (request: Parameters<typeof assertAllowedRequestOrigin>[0]): Promise<void> => {
      assertAllowedRequestOrigin(request, allowedOrigins);
    };
    const loginIpLimiter = authServer.createRateLimit({
      max: limits.loginIpMax,
      timeWindow: limits.loginWindowMs,
    });
    const loginEmailIpLimiter = authServer.createRateLimit({
      max: limits.loginEmailIpMax,
      timeWindow: limits.loginWindowMs,
      keyGenerator: loginEmailIpRateLimitKey,
    });
    const registerIpLimiter = authServer.createRateLimit({
      max: limits.registerIpMax,
      timeWindow: limits.registerWindowMs,
    });
    const enforce = (limiter: ReturnType<typeof authServer.createRateLimit>) =>
      async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const result = await limiter(request);
        if (!result.isAllowed && result.isExceeded) {
          reply.header("Retry-After", result.ttlInSeconds);
          throw authError("AUTH_RATE_LIMITED", "Too many authentication attempts. Try again later.");
        }
      };
    const loginIpLimit = enforce(loginIpLimiter);
    const loginEmailIpLimit = enforce(loginEmailIpLimiter);
    const registerIpLimit = enforce(registerIpLimiter);

    authServer.post("/api/v1/auth/register", { preHandler: [requireOrigin, registerIpLimit] }, async (request, reply) => {
      const result = await auth.register(readAuthRequestDto(request.body));
      setSessionCookie(reply, result.session.token, result.session.expiresAt, cookieConfig);
      return reply.code(201).send({ user: result.user, csrfToken: deriveCsrfToken(csrfSecret, result.session.id) });
    });

    authServer.post("/api/v1/auth/login", { preHandler: [requireOrigin, loginIpLimit, loginEmailIpLimit] }, async (request, reply) => {
      const result = await auth.login(readAuthRequestDto(request.body));
      setSessionCookie(reply, result.session.token, result.session.expiresAt, cookieConfig);
      return reply.code(200).send({ user: result.user, csrfToken: deriveCsrfToken(csrfSecret, result.session.id) });
    });

    authServer.get("/api/v1/auth/me", async (request, reply) => {
      const rawToken = readSessionToken(request);
      try {
        const context = await resolveAuthenticatedUser(request, auth);
        return reply.code(200).send({ user: context.user, csrfToken: deriveCsrfToken(csrfSecret, context.sessionId) });
      } catch (error) {
        if (rawToken !== undefined && isAuthApplicationError(error) && error.code === "UNAUTHENTICATED") {
          clearSessionCookie(reply, cookieConfig);
        }
        throw error;
      }
    });

    authServer.post("/api/v1/auth/logout", async (request, reply) => {
      const rawToken = readSessionToken(request);
      if (rawToken === undefined) {
        clearSessionCookie(reply, cookieConfig);
        return reply.code(204).send();
      }

      let context;
      try {
        context = await resolveAuthenticatedUser(request, auth);
      } catch (error) {
        if (isAuthApplicationError(error) && error.code === "UNAUTHENTICATED") {
          clearSessionCookie(reply, cookieConfig);
          return reply.code(204).send();
        }
        throw error;
      }

      assertAllowedRequestOrigin(request, allowedOrigins);
      assertValidCsrfToken(request.headers["x-csrf-token"], csrfSecret, context.sessionId);
      await auth.logout(rawToken);
      clearSessionCookie(reply, cookieConfig);
      return reply.code(204).send();
    });
  });
}
