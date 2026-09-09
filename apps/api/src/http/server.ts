import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import type { AuthRuntime } from "../auth/runtime/auth-runtime.js";
import { createPostgresAuthRuntime } from "../auth/runtime/auth-runtime.js";
import { closeProjectPool, createProjectPool } from "../persistence/postgres/database.js";
import { readAuthCookieConfig, type AuthCookieConfig } from "./auth-cookie.js";
import { registerAuthRoutes } from "./auth-routes.js";
import { registerErrorHandler } from "./error-handler.js";
import { registerRoutes, type HttpUseCases } from "./routes.js";
import {
  DEFAULT_AUTH_RATE_LIMITS,
  parseCorsOrigins,
  readCsrfSecret,
  readTrustProxy,
  validateCsrfSecret,
  type AuthRateLimitConfig,
} from "./auth-security.js";

export interface ServerOptions {
  readonly logger?: boolean;
  readonly useCases?: HttpUseCases;
  readonly auth?: AuthRuntime;
  readonly authCookie?: AuthCookieConfig;
  readonly csrfSecret?: string;
  readonly corsOrigins?: readonly string[];
  readonly trustProxy?: boolean;
  readonly authRateLimits?: AuthRateLimitConfig;
}

export function createServer(options: ServerOptions = {}): FastifyInstance {
  const allowedOrigins = parseCorsOrigins(options.corsOrigins?.join(",") ?? process.env.CORS_ORIGINS);
  const server = Fastify({
    bodyLimit: 64 * 1024,
    logger: options.logger ?? false,
    trustProxy: options.trustProxy ?? readTrustProxy(),
  });
  server.register(cookie);
  server.register(cors, {
    origin: [...allowedOrigins],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    credentials: true,
  });
  registerErrorHandler(server);
  server.addHook("onRequest", async (request, reply) => {
    const requiresJson = request.method === "POST" && request.url !== "/api/v1/auth/logout";
    if (requiresJson && request.url.startsWith("/api/v1/") && !/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] ?? "")) {
      if (request.url.startsWith("/api/v1/auth/")) {
        return reply.code(400).send({ error: { code: "INVALID_AUTH_REQUEST", message: "The authentication request is invalid." } });
      }
      return reply.code(415).send({ error: { code: "INVALID_REQUEST", message: "Content-Type must be application/json." } });
    }
  });
  registerRoutes(server, options.useCases);
  if (options.auth !== undefined) {
    const csrfSecret = options.csrfSecret === undefined ? readCsrfSecret() : validateCsrfSecret(options.csrfSecret);
    registerAuthRoutes(
      server,
      options.auth,
      options.authCookie ?? readAuthCookieConfig(),
      csrfSecret,
      allowedOrigins,
      options.authRateLimits ?? DEFAULT_AUTH_RATE_LIMITS,
    );
  }
  return server;
}

export async function startServer(): Promise<void> {
  const authCookie = readAuthCookieConfig();
  const pool = createProjectPool();
  const server = createServer({
    logger: true,
    auth: createPostgresAuthRuntime(pool),
    authCookie,
    csrfSecret: readCsrfSecret(),
  });
  server.addHook("onClose", async () => closeProjectPool(pool));
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  try {
    await server.listen({ port, host });
  } catch (error) {
    await server.close();
    throw error;
  }
}
