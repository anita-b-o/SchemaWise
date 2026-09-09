import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerErrorHandler } from "./error-handler.js";
import { registerRoutes, type HttpUseCases } from "./routes.js";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

function getCorsOrigins(): string[] {
  const configuredOrigins = process.env.CORS_ORIGINS;
  if (configuredOrigins === undefined) return DEFAULT_CORS_ORIGINS;
  return configuredOrigins.split(",").map((origin) => origin.trim()).filter(Boolean);
}

export interface ServerOptions {
  readonly logger?: boolean;
  readonly useCases?: HttpUseCases;
}

export function createServer(options: ServerOptions = {}): FastifyInstance {
  const server = Fastify({ bodyLimit: 64 * 1024, logger: options.logger ?? false });
  server.register(cors, {
    origin: getCorsOrigins(),
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
  });
  registerErrorHandler(server);
  server.addHook("onRequest", async (request, reply) => {
    if (request.method === "POST" && request.url.startsWith("/api/v1/") && !/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] ?? "")) {
      return reply.code(415).send({ error: { code: "INVALID_REQUEST", message: "Content-Type must be application/json." } });
    }
  });
  registerRoutes(server, options.useCases);
  return server;
}

export async function startServer(): Promise<void> {
  const server = createServer({ logger: true });
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  await server.listen({ port, host });
}
