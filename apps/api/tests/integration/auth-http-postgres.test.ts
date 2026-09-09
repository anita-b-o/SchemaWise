import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { Pool } from "pg";
import { runner } from "node-pg-migrate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AUTH_SESSION_COOKIE_NAME,
  closeProjectPool,
  createPostgresAuthRuntime,
  createProjectPool,
  createServer,
} from "../../src/index.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
  throw new Error("DATABASE_URL must point to an isolated PostgreSQL test database");
}

const schemaName = `schemawise_auth_http_${randomUUID().replaceAll("-", "")}`;
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");
const adminPool = new Pool({ connectionString: databaseUrl });
let pool: Pool;
const ORIGIN = "http://localhost:5173";
const CSRF_SECRET = "postgres-integration-csrf-secret-32-bytes";

async function request(
  baseUrl: string,
  method: "GET" | "POST",
  url: string,
  options: { payload?: unknown; cookie?: string; csrfToken?: string } = {},
): Promise<Response> {
  return fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      Origin: ORIGIN,
      ...(options.payload === undefined ? {} : { "Content-Type": "application/json" }),
      ...(options.cookie === undefined ? {} : { Cookie: options.cookie }),
      ...(options.csrfToken === undefined ? {} : { "X-CSRF-Token": options.csrfToken }),
    },
    ...(options.payload === undefined ? {} : { body: JSON.stringify(options.payload) }),
  });
}

function cookieParts(setCookie: string | string[] | undefined): { pair: string; rawToken: string } {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (header === undefined) throw new Error("Expected Set-Cookie");
  const pair = header.split(";", 1)[0]!;
  const prefix = `${AUTH_SESSION_COOKIE_NAME}=`;
  if (!pair.startsWith(prefix)) throw new Error("Unexpected session cookie");
  return { pair, rawToken: pair.slice(prefix.length) };
}

describe.sequential("PostgreSQL authentication HTTP adapter", () => {
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

  it("binds CSRF to PostgreSQL sessions and enforces logout through real TCP HTTP", async () => {
    const server = createServer({
      auth: createPostgresAuthRuntime(pool),
      authCookie: { secure: false },
      csrfSecret: CSRF_SECRET,
      corsOrigins: [ORIGIN],
    });
    try {
      await server.listen({ host: "127.0.0.1", port: 0 });
      const address = server.server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const password = "real postgres password 🔐";
      const registered = await request(baseUrl, "POST", "/api/v1/auth/register", { payload: { email: " HTTP@Example.COM ", password } });
      expect(registered.status).toBe(201);
      const registeredBody = await registered.json() as { user: { id: string; email: string }; csrfToken: string };
      expect(registeredBody.user.email).toBe("http@example.com");
      const cookie1 = cookieParts(registered.headers.get("set-cookie") ?? undefined);
      const csrfToken1 = registeredBody.csrfToken;

      const persisted = await pool.query<{ password_hash: string; token_hash: Buffer }>(
        `SELECT u.password_hash, s.token_hash
         FROM users u JOIN sessions s ON s.user_id = u.id
         WHERE u.id = $1`,
        [registeredBody.user.id],
      );
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0]!.password_hash).toMatch(/^\$argon2id\$/);
      expect(persisted.rows[0]!.password_hash).not.toContain(password);
      expect(persisted.rows[0]!.token_hash).toEqual(createHash("sha256").update(cookie1.rawToken).digest());
      expect(persisted.rows[0]!.token_hash).not.toEqual(Buffer.from(cookie1.rawToken));

      const me1 = await request(baseUrl, "GET", "/api/v1/auth/me", { cookie: cookie1.pair });
      expect(me1.status).toBe(200);
      expect(await me1.json()).toEqual(registeredBody);

      const loggedIn = await request(baseUrl, "POST", "/api/v1/auth/login", { payload: { email: "http@example.com", password } });
      expect(loggedIn.status).toBe(200);
      const loggedInBody = await loggedIn.json() as { user: { id: string; email: string }; csrfToken: string };
      const cookie2 = cookieParts(loggedIn.headers.get("set-cookie") ?? undefined);
      const csrfToken2 = loggedInBody.csrfToken;
      expect(cookie2.rawToken).not.toBe(cookie1.rawToken);
      expect(csrfToken2).not.toBe(csrfToken1);
      expect((await pool.query("SELECT id FROM sessions WHERE user_id = $1", [registeredBody.user.id])).rows).toHaveLength(2);

      const missingCsrf = await request(baseUrl, "POST", "/api/v1/auth/logout", { cookie: cookie1.pair });
      expect(missingCsrf.status).toBe(403);
      expect((await missingCsrf.json() as { error: { code: string } }).error.code).toBe("INVALID_CSRF_TOKEN");

      const wrongCsrf = await request(baseUrl, "POST", "/api/v1/auth/logout", { cookie: cookie1.pair, csrfToken: "wrong" });
      expect(wrongCsrf.status).toBe(403);

      const crossSession = await request(baseUrl, "POST", "/api/v1/auth/logout", { cookie: cookie1.pair, csrfToken: csrfToken2 });
      expect(crossSession.status).toBe(403);
      expect((await request(baseUrl, "GET", "/api/v1/auth/me", { cookie: cookie1.pair })).status).toBe(200);

      const logout = await request(baseUrl, "POST", "/api/v1/auth/logout", { cookie: cookie1.pair, csrfToken: csrfToken1 });
      expect(logout.status).toBe(204);
      expect((await pool.query("SELECT id FROM sessions WHERE user_id = $1", [registeredBody.user.id])).rows).toHaveLength(1);
      expect((await request(baseUrl, "GET", "/api/v1/auth/me", { cookie: cookie1.pair })).status).toBe(401);
      expect((await request(baseUrl, "GET", "/api/v1/auth/me", { cookie: cookie2.pair })).status).toBe(200);
    } finally { await server.close(); }
  });
});
