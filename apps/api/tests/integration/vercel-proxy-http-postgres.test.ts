import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { runner } from "node-pg-migrate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProxyHandler } from "../../../web/api/_proxy-core.js";
import {
  AUTH_SESSION_COOKIE_NAME,
  closeProjectPool,
  createPostgresAuthRuntime,
  createProjectPool,
  createServer,
  PostgresProjectRepository,
} from "../../src/index.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
  throw new Error("DATABASE_URL must point to an isolated PostgreSQL test database");
}

const schemaName = `schemawise_vercel_proxy_${randomUUID().replaceAll("-", "")}`;
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");
const adminPool = new Pool({ connectionString: databaseUrl });
const PROXY_SECRET = "postgres-proxy-integration-secret-32-bytes";
const CSRF_SECRET = "postgres-proxy-csrf-secret-at-least-32-bytes";
const WEB_ORIGIN = "https://schemawise-staging.vercel.app";
const CLIENT_IP = "2001:db8:1234:5678::42";
const PASSWORD = "real proxy integration password";
const emptySchema = { schemaVersion: 1 as const, relation: { name: "", attributes: [] }, functionalDependencies: [] };
let pool: Pool;

describe.sequential("browser -> Vercel proxy -> Fastify -> PostgreSQL", () => {
  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    await runner({
      databaseUrl: { connectionString: databaseUrl, options: `-c search_path=${schemaName}` },
      dir: migrationsDirectory,
      direction: "up",
      migrationsTable: "pgmigrations",
      migrationsSchema: schemaName,
      schema: schemaName,
      log: () => undefined,
    });
    pool = createProjectPool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
  });

  afterAll(async () => {
    if (pool !== undefined) await closeProjectPool(pool);
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await adminPool.end();
  });

  it("relays register, cookie/me, CSRF project save, and logout through authenticated assertions", async () => {
    const api = createServer({
      auth: createPostgresAuthRuntime(pool),
      projectRepository: new PostgresProjectRepository(pool),
      authCookie: { secure: true },
      csrfSecret: CSRF_SECRET,
      corsOrigins: [WEB_ORIGIN],
      clientIpMode: "vercel-proxy",
      stagingProxySecret: PROXY_SECRET,
    });
    try {
      await api.listen({ host: "127.0.0.1", port: 0 });
      const address = api.server.address() as AddressInfo;
      const proxy = createProxyHandler({
        environment: {
          RENDER_API_ORIGIN: `http://127.0.0.1:${address.port}`,
          STAGING_PROXY_SECRET: PROXY_SECRET,
        },
      });
      const throughProxy = (method: string, route: string, options: { body?: unknown; cookie?: string; csrf?: string } = {}) => proxy(
        new Request(`${WEB_ORIGIN}${route}`, {
          method,
          headers: {
            "x-vercel-forwarded-for": CLIENT_IP,
            origin: WEB_ORIGIN,
            referer: `${WEB_ORIGIN}/workspace`,
            ...(options.body === undefined ? {} : { "content-type": "application/json" }),
            ...(options.cookie === undefined ? {} : { cookie: options.cookie }),
            ...(options.csrf === undefined ? {} : { "x-csrf-token": options.csrf }),
          },
          ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        }),
      );

      const registered = await throughProxy("POST", "/api/v1/auth/register", {
        body: { email: "proxy@example.com", password: PASSWORD },
      });
      expect(registered.status).toBe(201);
      const registration = await registered.json() as { user: { id: string; email: string }; csrfToken: string };
      const setCookie = registered.headers.getSetCookie();
      expect(setCookie).toHaveLength(1);
      expect(setCookie[0]).toContain(`${AUTH_SESSION_COOKIE_NAME}=`);
      expect(setCookie[0]).toContain("HttpOnly");
      expect(setCookie[0]).toContain("Secure");
      expect(setCookie[0]).toContain("SameSite=Lax");
      expect(setCookie[0]).toContain("Path=/");
      expect(setCookie[0]).not.toContain("Domain=");
      const cookie = setCookie[0]!.split(";", 1)[0]!;

      const me = await throughProxy("GET", "/api/v1/auth/me", { cookie });
      expect(me.status).toBe(200);
      expect(await me.json()).toEqual(registration);

      const saved = await throughProxy("POST", "/api/v1/projects", {
        cookie,
        csrf: registration.csrfToken,
        body: { name: "Through proxy", schema: emptySchema },
      });
      expect(saved.status).toBe(201);
      expect((await saved.json() as { project: { name: string } }).project.name).toBe("Through proxy");
      expect((await pool.query("SELECT name FROM projects WHERE owner_id = $1", [registration.user.id])).rows).toEqual([{ name: "Through proxy" }]);

      const logout = await throughProxy("POST", "/api/v1/auth/logout", { cookie, csrf: registration.csrfToken });
      expect(logout.status).toBe(204);
      expect(logout.headers.getSetCookie()).toHaveLength(1);
      expect(logout.headers.getSetCookie()[0]).toContain(`${AUTH_SESSION_COOKIE_NAME}=`);
      expect((await pool.query("SELECT id FROM sessions WHERE user_id = $1", [registration.user.id])).rows).toHaveLength(0);
    } finally { await api.close(); }
  });
});
