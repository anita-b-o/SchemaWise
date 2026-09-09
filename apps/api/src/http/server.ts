import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import type { AuthRuntime } from "../auth/runtime/auth-runtime.js";
import { createPostgresAuthRuntime } from "../auth/runtime/auth-runtime.js";
import { closeProjectPool, createProjectPool } from "../persistence/postgres/database.js";
import type { ProjectRepository } from "../persistence/ports/project-repository.js";
import { PostgresProjectRepository } from "../persistence/postgres/postgres-project-repository.js";
import { readAuthCookieConfig, type AuthCookieConfig } from "./auth-cookie.js";
import { registerAuthRoutes } from "./auth-routes.js";
import { registerErrorHandler } from "./error-handler.js";
import { registerRoutes, type HttpUseCases } from "./routes.js";
import { registerProjectRoutes } from "./project-routes.js";
import { registerOperationsRoutes, type ReadinessCheck } from "./operations-routes.js";
import { readRuntimeConfig } from "../runtime/config.js";
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
  readonly projectRepository?: ProjectRepository;
  readonly readinessCheck?: ReadinessCheck;
}

export function createServer(options: ServerOptions = {}): FastifyInstance {
  const allowedOrigins = parseCorsOrigins(options.corsOrigins?.join(",") ?? process.env.CORS_ORIGINS);
  const server = Fastify({
    bodyLimit: 64 * 1024,
    logger: options.logger === true ? {
      level: "info",
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie", "req.headers.x-csrf-token"],
        censor: "[REDACTED]",
      },
    } : false,
    trustProxy: options.trustProxy ?? readTrustProxy(),
  });
  server.register(cookie);
  server.register(cors, {
    origin: [...allowedOrigins],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    credentials: true,
  });
  registerErrorHandler(server);
  registerOperationsRoutes(server, options.readinessCheck);
  server.addHook("onRequest", async (request, reply) => {
    const requiresJson = (request.method === "POST" && request.url !== "/api/v1/auth/logout") || request.method === "PUT";
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
    if (options.projectRepository !== undefined) {
      registerProjectRoutes(server, options.auth, options.projectRepository, csrfSecret, allowedOrigins);
    }
  }
  return server;
}

export async function startServer(): Promise<void> {
  const config = readRuntimeConfig();
  const pool = createProjectPool(config.database);
  const server = createServer({
    logger: true,
    auth: createPostgresAuthRuntime(pool),
    projectRepository: new PostgresProjectRepository(pool),
    readinessCheck: pool,
    authCookie: config.authCookie,
    csrfSecret: config.csrfSecret,
    corsOrigins: config.corsOrigins,
    trustProxy: config.trustProxy,
  });
  server.addHook("onClose", async () => closeProjectPool(pool));
  const shutdown = createGracefulShutdown(server);
  const handleSignal = (signal: NodeJS.Signals) => {
    server.log.info({ signal }, "Shutdown requested");
    void shutdown().catch((error: unknown) => {
      server.log.error({ errorType: error instanceof Error ? error.name : typeof error }, "Graceful shutdown failed");
      process.exitCode = 1;
    });
  };
  process.once("SIGTERM", handleSignal);
  process.once("SIGINT", handleSignal);
  server.addHook("onClose", async () => {
    process.off("SIGTERM", handleSignal);
    process.off("SIGINT", handleSignal);
  });
  try {
    await server.listen({ port: config.port, host: config.host });
  } catch (error) {
    await shutdown();
    throw error;
  }
}

export function createGracefulShutdown(server: FastifyInstance): () => Promise<void> {
  let closing: Promise<void> | undefined;
  return () => {
    closing ??= server.close();
    return closing;
  };
}
