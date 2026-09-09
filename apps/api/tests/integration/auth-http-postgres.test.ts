import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
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

function post(url: string, payload?: unknown, cookie?: string) {
  return {
    method: "POST" as const,
    url,
    headers: {
      ...(payload === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie === undefined ? {} : { cookie }),
    },
    ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
  };
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

  it("persists register, supports two sessions, and revokes only the logged-out cookie through real HTTP", async () => {
    const server = createServer({ auth: createPostgresAuthRuntime(pool), authCookie: { secure: false } });
    try {
      const password = "real postgres password 🔐";
      const registered = await server.inject(post("/api/v1/auth/register", { email: " HTTP@Example.COM ", password }));
      expect(registered.statusCode).toBe(201);
      expect(registered.json().user.email).toBe("http@example.com");
      const cookie1 = cookieParts(registered.headers["set-cookie"]);

      const persisted = await pool.query<{ password_hash: string; token_hash: Buffer }>(
        `SELECT u.password_hash, s.token_hash
         FROM users u JOIN sessions s ON s.user_id = u.id
         WHERE u.id = $1`,
        [registered.json().user.id],
      );
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0]!.password_hash).toMatch(/^\$argon2id\$/);
      expect(persisted.rows[0]!.password_hash).not.toContain(password);
      expect(persisted.rows[0]!.token_hash).toEqual(createHash("sha256").update(cookie1.rawToken).digest());
      expect(persisted.rows[0]!.token_hash).not.toEqual(Buffer.from(cookie1.rawToken));

      const me1 = await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie1.pair } });
      expect(me1.statusCode).toBe(200);
      expect(me1.json()).toEqual(registered.json());

      const loggedIn = await server.inject(post("/api/v1/auth/login", { email: "http@example.com", password }));
      expect(loggedIn.statusCode).toBe(200);
      const cookie2 = cookieParts(loggedIn.headers["set-cookie"]);
      expect(cookie2.rawToken).not.toBe(cookie1.rawToken);
      expect((await pool.query("SELECT id FROM sessions WHERE user_id = $1", [registered.json().user.id])).rows).toHaveLength(2);
      expect((await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie1.pair } })).statusCode).toBe(200);
      expect((await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie2.pair } })).statusCode).toBe(200);

      const logout = await server.inject(post("/api/v1/auth/logout", undefined, cookie1.pair));
      expect(logout.statusCode).toBe(204);
      expect((await pool.query("SELECT id FROM sessions WHERE user_id = $1", [registered.json().user.id])).rows).toHaveLength(1);
      expect((await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie1.pair } })).statusCode).toBe(401);
      expect((await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie2.pair } })).statusCode).toBe(200);
    } finally { await server.close(); }
  });
});
