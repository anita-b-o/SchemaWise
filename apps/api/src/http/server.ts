import Fastify, { type FastifyInstance } from "fastify";
import { registerErrorHandler } from "./error-handler.js";
import { registerRoutes, type HttpUseCases } from "./routes.js";

export interface ServerOptions {
  readonly logger?: boolean;
  readonly useCases?: HttpUseCases;
}

export function createServer(options: ServerOptions = {}): FastifyInstance {
  const server = Fastify({ bodyLimit: 64 * 1024, logger: options.logger ?? false });
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
