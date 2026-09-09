import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { Pool } from "pg";
import { runner } from "node-pg-migrate";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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

const schemaName = `schemawise_project_http_${randomUUID().replaceAll("-", "")}`;
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");
const adminPool = new Pool({ connectionString: databaseUrl });
const CSRF_SECRET = "project-postgres-http-csrf-secret-32-bytes";
const ORIGIN = "http://localhost:5173";
const PASSWORD = "real project password";
const emptySchema = { schemaVersion: 1 as const, relation: { name: "", attributes: [] }, functionalDependencies: [] };
let pool: Pool;

function cookiePair(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (header === undefined) throw new Error("Expected Set-Cookie");
  const pair = header.split(";", 1)[0]!;
  if (!pair.startsWith(`${AUTH_SESSION_COOKIE_NAME}=`)) throw new Error("Unexpected cookie");
  return pair;
}

function configuredServer() {
  return createServer({
    auth: createPostgresAuthRuntime(pool),
    projectRepository: new PostgresProjectRepository(pool),
    authCookie: { secure: false },
    csrfSecret: CSRF_SECRET,
    corsOrigins: [ORIGIN],
  });
}

function jsonHeaders(cookie?: string, csrfToken?: string): Record<string, string> {
  return {
    "content-type": "application/json",
    origin: ORIGIN,
    ...(cookie === undefined ? {} : { cookie }),
    ...(csrfToken === undefined ? {} : { "x-csrf-token": csrfToken }),
  };
}

async function registerInject(server: ReturnType<typeof configuredServer>, email: string) {
  const response = await server.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: jsonHeaders(),
    payload: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(response.statusCode).toBe(201);
  return { cookie: cookiePair(response.headers["set-cookie"]), csrf: response.json().csrfToken as string };
}

async function createInject(server: ReturnType<typeof configuredServer>, auth: { cookie: string; csrf: string }, name: string) {
  const response = await server.inject({
    method: "POST",
    url: "/api/v1/projects",
    headers: jsonHeaders(auth.cookie, auth.csrf),
    payload: JSON.stringify({ name, schema: emptySchema }),
  });
  expect(response.statusCode).toBe(201);
  return response.json().project as { id: string; revision: number };
}

describe.sequential("PostgreSQL Project HTTP v1", () => {
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

  beforeEach(async () => {
    await pool.query("TRUNCATE projects, users CASCADE");
  });

  afterAll(async () => {
    if (pool !== undefined) await closeProjectPool(pool);
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await adminPool.end();
  });

  it("enforces owner isolation, HTTP OCC concurrency, and cross-session CSRF with real sessions", async () => {
    const server = configuredServer();
    try {
      const a1 = await registerInject(server, "a-project@example.com");
      const loginA2 = await server.inject({
        method: "POST", url: "/api/v1/auth/login", headers: jsonHeaders(),
        payload: JSON.stringify({ email: "a-project@example.com", password: PASSWORD }),
      });
      expect(loginA2.statusCode).toBe(200);
      const a2 = { cookie: cookiePair(loginA2.headers["set-cookie"]), csrf: loginA2.json().csrfToken as string };
      const b = await registerInject(server, "b-project@example.com");
      const a1Project = await createInject(server, a1, "A1");
      await createInject(server, a1, "A2");
      const b1Project = await createInject(server, b, "B1");

      const listA = await server.inject({ method: "GET", url: "/api/v1/projects", headers: { cookie: a1.cookie } });
      const listB = await server.inject({ method: "GET", url: "/api/v1/projects", headers: { cookie: b.cookie } });
      expect(listA.json()).toMatchObject({ total: 2, projects: expect.arrayContaining([expect.objectContaining({ name: "A1" }), expect.objectContaining({ name: "A2" })]) });
      expect(listB.json()).toMatchObject({ total: 1, projects: [expect.objectContaining({ name: "B1" })] });

      const foreignGet = await server.inject({ method: "GET", url: `/api/v1/projects/${b1Project.id}`, headers: { cookie: a1.cookie } });
      expect(foreignGet.statusCode).toBe(404);
      const foreignUpdate = await server.inject({
        method: "PUT", url: `/api/v1/projects/${a1Project.id}`, headers: jsonHeaders(b.cookie, b.csrf),
        payload: JSON.stringify({ name: "Intrusion", schema: emptySchema, expectedRevision: 1 }),
      });
      expect(foreignUpdate.statusCode).toBe(404);
      expect(foreignUpdate.body).not.toContain("actualRevision");

      const crossSession = await server.inject({
        method: "PUT", url: `/api/v1/projects/${a1Project.id}`, headers: jsonHeaders(a1.cookie, a2.csrf),
        payload: JSON.stringify({ name: "Cross session", schema: emptySchema, expectedRevision: 1 }),
      });
      expect(crossSession.statusCode).toBe(403);

      const concurrent = await Promise.all([
        server.inject({ method: "PUT", url: `/api/v1/projects/${a1Project.id}`, headers: jsonHeaders(a1.cookie, a1.csrf), payload: JSON.stringify({ name: "Winner A", schema: emptySchema, expectedRevision: 1 }) }),
        server.inject({ method: "PUT", url: `/api/v1/projects/${a1Project.id}`, headers: jsonHeaders(a1.cookie, a1.csrf), payload: JSON.stringify({ name: "Winner B", schema: emptySchema, expectedRevision: 1 }) }),
      ]);
      expect(concurrent.map(({ statusCode }) => statusCode).sort()).toEqual([200, 409]);
      expect(concurrent.find(({ statusCode }) => statusCode === 200)?.json().project.revision).toBe(2);
      expect(concurrent.find(({ statusCode }) => statusCode === 409)?.json().error.code).toBe("PROJECT_REVISION_CONFLICT");

      const stale = await server.inject({
        method: "PUT", url: `/api/v1/projects/${a1Project.id}`, headers: jsonHeaders(a1.cookie, a1.csrf),
        payload: JSON.stringify({ name: "Stale", schema: emptySchema, expectedRevision: 1 }),
      });
      expect(stale.statusCode).toBe(409);
      const bAfter = await server.inject({
        method: "PUT", url: `/api/v1/projects/${a1Project.id}`, headers: jsonHeaders(b.cookie, b.csrf),
        payload: JSON.stringify({ name: "B after", schema: emptySchema, expectedRevision: 2 }),
      });
      expect(bAfter.statusCode).toBe(404);

      const foreignDelete = await server.inject({
        method: "DELETE",
        url: `/api/v1/projects/${b1Project.id}`,
        headers: { origin: ORIGIN, cookie: a1.cookie, "x-csrf-token": a1.csrf },
      });
      expect(foreignDelete.statusCode).toBe(404);
      const bStillVisible = await server.inject({ method: "GET", url: `/api/v1/projects/${b1Project.id}`, headers: { cookie: b.cookie } });
      expect(bStillVisible.statusCode).toBe(200);
    } finally { await server.close(); }
  });

  it("completes the two-user project lifecycle over a real TCP listener", async () => {
    const server = configuredServer();
    try {
      await server.listen({ host: "127.0.0.1", port: 0 });
      const address = server.server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const request = (method: string, route: string, options: { cookie?: string; csrf?: string; body?: unknown } = {}) => fetch(`${baseUrl}${route}`, {
        method,
        headers: {
          origin: ORIGIN,
          ...(options.body === undefined ? {} : { "content-type": "application/json" }),
          ...(options.cookie === undefined ? {} : { cookie: options.cookie }),
          ...(options.csrf === undefined ? {} : { "x-csrf-token": options.csrf }),
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
      const register = async (email: string) => {
        const response = await request("POST", "/api/v1/auth/register", { body: { email, password: PASSWORD } });
        expect(response.status).toBe(201);
        const body = await response.json() as { csrfToken: string };
        return { cookie: cookiePair(response.headers.get("set-cookie") ?? undefined), csrf: body.csrfToken };
      };
      await register("tcp-a@example.com");
      const loginA = await request("POST", "/api/v1/auth/login", { body: { email: "tcp-a@example.com", password: PASSWORD } });
      expect(loginA.status).toBe(200);
      const loginABody = await loginA.json() as { csrfToken: string };
      const a = { cookie: cookiePair(loginA.headers.get("set-cookie") ?? undefined), csrf: loginABody.csrfToken };
      const createdResponse = await request("POST", "/api/v1/projects", { ...a, body: { name: "TCP A", schema: emptySchema } });
      expect(createdResponse.status).toBe(201);
      const created = await createdResponse.json() as { project: { id: string } };
      expect((await request("GET", "/api/v1/projects", { cookie: a.cookie })).status).toBe(200);
      expect((await request("GET", `/api/v1/projects/${created.project.id}`, { cookie: a.cookie })).status).toBe(200);
      const updated = await request("PUT", `/api/v1/projects/${created.project.id}`, { ...a, body: { name: "TCP updated", schema: emptySchema, expectedRevision: 1 } });
      expect(updated.status).toBe(200);

      const b = await register("tcp-b@example.com");
      const bList = await request("GET", "/api/v1/projects", { cookie: b.cookie });
      expect(bList.status).toBe(200);
      expect(await bList.json()).toMatchObject({ projects: [], total: 0 });
      const foreign = await request("GET", `/api/v1/projects/${created.project.id}`, { cookie: b.cookie });
      expect(foreign.status).toBe(404);
      const deleted = await request("DELETE", `/api/v1/projects/${created.project.id}`, a);
      expect(deleted.status).toBe(204);
    } finally { await server.close(); }
  });
});
