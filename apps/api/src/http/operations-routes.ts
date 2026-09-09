import type { FastifyInstance } from "fastify";

export interface ReadinessCheck {
  query(text: string): Promise<unknown>;
}

export function registerOperationsRoutes(server: FastifyInstance, database?: ReadinessCheck): void {
  server.get("/health", async (_request, reply) => reply.code(200).send({ status: "ok" }));

  server.get("/ready", async (_request, reply) => {
    try {
      if (database === undefined) throw new Error("Database readiness is not configured");
      await database.query("SELECT 1");
      return reply.code(200).send({ status: "ready" });
    } catch {
      return reply.code(503).send({ status: "not-ready" });
    }
  });
}
