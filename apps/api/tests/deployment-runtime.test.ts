import { describe, expect, it, vi } from "vitest";
import {
  createGracefulShutdown,
  createServer,
  readRuntimeConfig,
  type ReadinessCheck,
} from "../src/index.js";

const productionEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://schemawise:secret@db.example/schemawise?sslmode=verify-full",
  AUTH_COOKIE_SECURE: "true",
  CSRF_SECRET: "a-production-csrf-secret-with-at-least-32-bytes",
  CORS_ORIGINS: "https://app.schemawise.example",
  TRUST_PROXY: "false",
  HOST: "0.0.0.0",
  PORT: "3000",
} satisfies NodeJS.ProcessEnv;

describe("deployment operations", () => {
  it("serves health without authentication or a database dependency", async () => {
    const server = createServer();
    try {
      for (let index = 0; index < 10; index += 1) {
        const response = await server.inject({ method: "GET", url: "/health" });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ status: "ok" });
      }
    } finally {
      await server.close();
    }
  });

  it("reports ready after the minimal PostgreSQL check", async () => {
    const query = vi.fn<ReadinessCheck["query"]>().mockResolvedValue({ rows: [{ "?column?": 1 }] });
    const server = createServer({ readinessCheck: { query } });
    try {
      const response = await server.inject({ method: "GET", url: "/ready" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ready" });
      expect(query).toHaveBeenCalledWith("SELECT 1");
    } finally {
      await server.close();
    }
  });

  it("returns a sanitized 503 when PostgreSQL is unavailable", async () => {
    const query = vi.fn<ReadinessCheck["query"]>().mockRejectedValue(new Error("password=secret SQL details"));
    const server = createServer({ readinessCheck: { query } });
    try {
      const response = await server.inject({ method: "GET", url: "/ready" });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ status: "not-ready" });
      expect(response.body).not.toContain("secret");
      expect(response.body).not.toContain("SQL");
    } finally {
      await server.close();
    }
  });

  it("closes Fastify and its registered pool hook exactly once", async () => {
    const server = createServer();
    const closePool = vi.fn(async () => undefined);
    server.addHook("onClose", closePool);
    const shutdown = createGracefulShutdown(server);

    const first = shutdown();
    const second = shutdown();
    expect(second).toBe(first);
    await first;
    expect(closePool).toHaveBeenCalledOnce();
  });
});

describe("runtime configuration", () => {
  it("reads a production-safe configuration and a bounded pool", () => {
    expect(readRuntimeConfig(productionEnvironment)).toMatchObject({
      authCookie: { secure: true },
      corsOrigins: ["https://app.schemawise.example"],
      trustProxy: false,
      host: "0.0.0.0",
      port: 3000,
      database: {
        max: 5,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 30_000,
        query_timeout: 5_000,
      },
    });
  });

  it("fails production startup without explicit CORS or secure cookies", () => {
    expect(() => readRuntimeConfig({ ...productionEnvironment, CORS_ORIGINS: undefined })).toThrow(
      "CORS_ORIGINS is required when NODE_ENV=production",
    );
    expect(() => readRuntimeConfig({ ...productionEnvironment, AUTH_COOKIE_SECURE: "false" })).toThrow(
      "AUTH_COOKIE_SECURE must be true when NODE_ENV=production",
    );
  });

  it("rejects invalid ports, proxy settings, database URLs, and pool sizes", () => {
    expect(() => readRuntimeConfig({ ...productionEnvironment, PORT: "3.5" })).toThrow("PORT");
    expect(() => readRuntimeConfig({ ...productionEnvironment, TRUST_PROXY: "1" })).toThrow("TRUST_PROXY");
    expect(() => readRuntimeConfig({ ...productionEnvironment, DATABASE_URL: "not-a-url" })).toThrow("DATABASE_URL");
    expect(() => readRuntimeConfig({ ...productionEnvironment, DATABASE_POOL_MAX: "21" })).toThrow("DATABASE_POOL_MAX");
  });
});
