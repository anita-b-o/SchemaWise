import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AUTH_SESSION_COOKIE_NAME,
  authError,
  createServer,
  deriveCsrfToken,
  type AuthRuntime,
  type NewProject,
  type Project,
  type ProjectDeleteResult,
  type ProjectListQuery,
  type ProjectListResult,
  type ProjectReplacement,
  type ProjectRepository,
  type ProjectUpdateResult,
} from "../src/index.js";

const CSRF_SECRET = "project-http-test-csrf-secret-32-bytes";
const ORIGIN = "http://localhost:5173";
const USER_A = "10000000-0000-4000-8000-000000000001";
const USER_B = "10000000-0000-4000-8000-000000000002";
const emptySchema = {
  schemaVersion: 1 as const,
  relation: { name: "", attributes: [] },
  functionalDependencies: [],
};

const sessions = {
  a1: { raw: "A".repeat(43), id: "20000000-0000-4000-8000-000000000001", userId: USER_A },
  a2: { raw: "B".repeat(43), id: "20000000-0000-4000-8000-000000000002", userId: USER_A },
  b1: { raw: "C".repeat(43), id: "20000000-0000-4000-8000-000000000003", userId: USER_B },
};

function authRuntime(): AuthRuntime {
  return {
    register: async () => { throw new Error("unused"); },
    login: async () => { throw new Error("unused"); },
    authenticate: async (rawToken) => {
      const session = Object.values(sessions).find((candidate) => candidate.raw === rawToken);
      if (session === undefined) {
        throw authError("UNAUTHENTICATED", "Authentication is required.");
      }
      return {
        sessionId: session.id,
        user: { id: session.userId, email: `${session.userId === USER_A ? "a" : "b"}@example.com` },
      };
    },
    logout: async () => undefined,
  };
}

class MemoryProjectRepository implements ProjectRepository {
  readonly projects = new Map<string, Project>();
  calls = 0;
  private tick = 0;

  private date(): Date {
    return new Date(Date.UTC(2026, 8, 9, 12, 0, this.tick++));
  }

  async create(ownerId: string, project: NewProject): Promise<Project> {
    this.calls++;
    const now = this.date();
    const created = { ...project, ownerId, revision: 1, createdAt: now, updatedAt: now };
    this.projects.set(created.id, created);
    return created;
  }

  async findById(ownerId: string, projectId: string): Promise<Project | null> {
    this.calls++;
    const project = this.projects.get(projectId);
    return project?.ownerId === ownerId ? project : null;
  }

  async list(ownerId: string, query: ProjectListQuery): Promise<ProjectListResult> {
    this.calls++;
    const owned = [...this.projects.values()].filter((project) => project.ownerId === ownerId);
    return {
      projects: owned.slice(query.offset, query.offset + query.limit).map((project) => ({
        id: project.id,
        name: project.name,
        relationName: project.schema.relation.name,
        attributeCount: project.schema.relation.attributes.length,
        functionalDependencyCount: project.schema.functionalDependencies.length,
        revision: project.revision,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })),
      total: owned.length,
    };
  }

  async update(ownerId: string, projectId: string, expectedRevision: number, replacement: ProjectReplacement): Promise<ProjectUpdateResult> {
    this.calls++;
    const current = this.projects.get(projectId);
    if (current?.ownerId !== ownerId) return { kind: "not-found" };
    if (current.revision !== expectedRevision) return { kind: "revision-conflict", actualRevision: current.revision };
    const project = { ...current, ...replacement, revision: current.revision + 1, updatedAt: this.date() };
    this.projects.set(projectId, project);
    return { kind: "updated", project };
  }

  async delete(ownerId: string, projectId: string): Promise<ProjectDeleteResult> {
    this.calls++;
    const current = this.projects.get(projectId);
    if (current?.ownerId !== ownerId) return { kind: "not-found" };
    this.projects.delete(projectId);
    return { kind: "deleted" };
  }
}

function setup() {
  const repository = new MemoryProjectRepository();
  const server = createServer({
    auth: authRuntime(),
    projectRepository: repository,
    authCookie: { secure: false },
    csrfSecret: CSRF_SECRET,
    corsOrigins: [ORIGIN],
  });
  return { server, repository };
}

function headers(session = sessions.a1, csrf = true, origin = ORIGIN): Record<string, string> {
  return {
    cookie: `${AUTH_SESSION_COOKIE_NAME}=${session.raw}`,
    ...(csrf ? { "x-csrf-token": deriveCsrfToken(CSRF_SECRET, session.id) } : {}),
    ...(origin === "" ? {} : { origin }),
  };
}

function mutation(method: "POST" | "PUT", url: string, body: unknown, requestHeaders = headers()) {
  return { method, url, headers: { "content-type": "application/json", ...requestHeaders }, payload: JSON.stringify(body) } as const;
}

describe("authenticated Project HTTP v1", () => {
  it("authenticates before touching persistence on every route", async () => {
    const { server, repository } = setup();
    try {
      for (const request of [
        { method: "POST", url: "/api/v1/projects", headers: { "content-type": "application/json" }, payload: JSON.stringify({ name: "x", schema: emptySchema }) },
        { method: "GET", url: "/api/v1/projects" },
        { method: "GET", url: `/api/v1/projects/${randomUUID()}` },
        { method: "PUT", url: `/api/v1/projects/${randomUUID()}`, headers: { "content-type": "application/json" }, payload: JSON.stringify({ name: "x", schema: emptySchema, expectedRevision: 1 }) },
        { method: "DELETE", url: `/api/v1/projects/${randomUUID()}` },
      ] as const) {
        const response = await server.inject(request);
        expect(response.statusCode).toBe(401);
        expect(response.json().error.code).toBe("UNAUTHENTICATED");
      }
      expect(repository.calls).toBe(0);
    } finally { await server.close(); }
  });

  it("requires session-bound CSRF and allowed provenance on all mutations", async () => {
    const { server, repository } = setup();
    try {
      const id = randomUUID();
      for (const request of [
        mutation("POST", "/api/v1/projects", { name: "x", schema: emptySchema }, headers(sessions.a1, false)),
        mutation("PUT", `/api/v1/projects/${id}`, { name: "x", schema: emptySchema, expectedRevision: 1 }, headers(sessions.a1, false)),
        { method: "DELETE" as const, url: `/api/v1/projects/${id}`, headers: headers(sessions.a1, false) },
        mutation("POST", "/api/v1/projects", { name: "x", schema: emptySchema }, headers(sessions.a1, true, "https://evil.example")),
      ]) {
        const response = await server.inject(request);
        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe("INVALID_CSRF_TOKEN");
      }
      expect(repository.calls).toBe(0);
    } finally { await server.close(); }
  });

  it("creates an incomplete draft for the authenticated owner and rejects identity injection", async () => {
    const { server, repository } = setup();
    try {
      const invalid = await server.inject(mutation("POST", "/api/v1/projects", { name: "Injected", schema: emptySchema, ownerId: USER_B }));
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error.code).toBe("INVALID_PROJECT");
      expect(repository.calls).toBe(0);

      const response = await server.inject(mutation("POST", "/api/v1/projects", { name: "  Exercise 1  ", schema: emptySchema }));
      expect(response.statusCode).toBe(201);
      expect(response.json().project).toMatchObject({ name: "Exercise 1", schema: emptySchema, revision: 1 });
      expect(response.json().project.createdAt).toBe("2026-09-09T12:00:00.000Z");
      expect(response.body).not.toContain("ownerId");
      expect([...repository.projects.values()][0]?.ownerId).toBe(USER_A);
    } finally { await server.close(); }
  });

  it("maps validation, semantic limits, malformed IDs, persistence errors, and payload limits", async () => {
    const { server, repository } = setup();
    try {
      const invalid = await server.inject(mutation("POST", "/api/v1/projects", { name: "", schema: emptySchema }));
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error.code).toBe("INVALID_PROJECT");
      const limit = await server.inject(mutation("POST", "/api/v1/projects", { name: "x".repeat(121), schema: emptySchema }));
      expect(limit.statusCode).toBe(422);
      expect(limit.json().error.code).toBe("PROJECT_LIMIT_EXCEEDED");
      const malformed = await server.inject({ method: "GET", url: "/api/v1/projects/not-a-uuid", headers: headers(sessions.a1, false) });
      expect(malformed.statusCode).toBe(400);
      expect(malformed.json().error.code).toBe("INVALID_PROJECT");
      repository.list = async () => { throw new Error("SQL secret"); };
      const failed = await server.inject({ method: "GET", url: "/api/v1/projects", headers: headers(sessions.a1, false) });
      expect(failed.statusCode).toBe(500);
      expect(failed.json()).toEqual({ error: { code: "PERSISTENCE_ERROR", message: "The project persistence operation failed." } });
      expect(failed.body).not.toContain("SQL secret");
      const oversized = await server.inject(mutation("POST", "/api/v1/projects", { name: "x", schema: emptySchema, padding: "x".repeat(65_536) }));
      expect(oversized.statusCode).toBe(413);
      expect(oversized.json().error.code).toBe("PROJECT_LIMIT_EXCEEDED");
      const oversizedUpdate = await server.inject(mutation("PUT", `/api/v1/projects/${randomUUID()}`, { name: "x", schema: emptySchema, expectedRevision: 1, padding: "x".repeat(65_536) }));
      expect(oversizedUpdate.statusCode).toBe(413);
      expect(oversizedUpdate.json().error.code).toBe("PROJECT_LIMIT_EXCEEDED");
    } finally { await server.close(); }
  });

  it("lists compact owner-scoped summaries with flat defaults and pagination", async () => {
    const { server, repository } = setup();
    try {
      await server.inject(mutation("POST", "/api/v1/projects", { name: "A1", schema: emptySchema }, headers(sessions.a1)));
      await server.inject(mutation("POST", "/api/v1/projects", { name: "A2", schema: emptySchema }, headers(sessions.a1)));
      await server.inject(mutation("POST", "/api/v1/projects", { name: "B1", schema: emptySchema }, headers(sessions.b1)));
      const page = await server.inject({ method: "GET", url: "/api/v1/projects?limit=1&offset=1", headers: headers(sessions.a1, false) });
      expect(page.statusCode).toBe(200);
      expect(page.json()).toMatchObject({ total: 2, limit: 1, offset: 1, projects: [{ name: "A2", relationName: "", attributeCount: 0, functionalDependencyCount: 0 }] });
      expect(page.json().projects[0]).not.toHaveProperty("schema");
      expect(page.body).not.toContain("ownerId");
      const defaults = await server.inject({ method: "GET", url: "/api/v1/projects", headers: headers(sessions.b1, false) });
      expect(defaults.json()).toMatchObject({ total: 1, limit: 20, offset: 0, projects: [{ name: "B1" }] });
      for (const query of ["limit=0", "limit=101", "limit=NaN", "limit=1.5", "offset=-1", "offset=1.5", "other=1"]) {
        const response = await server.inject({ method: "GET", url: `/api/v1/projects?${query}`, headers: headers(sessions.a1, false) });
        expect([400, 422]).toContain(response.statusCode);
      }
    } finally { await server.close(); }
  });

  it("gets own projects while foreign and missing projects share the same 404 shape", async () => {
    const { server, repository } = setup();
    try {
      const own = await repository.create(USER_A, { id: randomUUID(), name: "A1", schema: emptySchema });
      const foreign = await repository.create(USER_B, { id: randomUUID(), name: "B1", schema: emptySchema });
      const ownResponse = await server.inject({ method: "GET", url: `/api/v1/projects/${own.id}`, headers: headers(sessions.a1, false) });
      expect(ownResponse.statusCode).toBe(200);
      expect(ownResponse.json().project.name).toBe("A1");
      const foreignResponse = await server.inject({ method: "GET", url: `/api/v1/projects/${foreign.id}`, headers: headers(sessions.a1, false) });
      const missingResponse = await server.inject({ method: "GET", url: `/api/v1/projects/${randomUUID()}`, headers: headers(sessions.a1, false) });
      expect(foreignResponse.statusCode).toBe(404);
      expect(missingResponse.statusCode).toBe(404);
      expect(foreignResponse.json().error.code).toBe("PROJECT_NOT_FOUND");
      expect(missingResponse.json().error.code).toBe("PROJECT_NOT_FOUND");
    } finally { await server.close(); }
  });

  it("updates with OCC, hides foreign revisions, and binds CSRF to the exact session", async () => {
    const { server, repository } = setup();
    try {
      const own = await repository.create(USER_A, { id: randomUUID(), name: "A1", schema: emptySchema });
      const crossSession = await server.inject(mutation("PUT", `/api/v1/projects/${own.id}`, { name: "Cross", schema: emptySchema, expectedRevision: 1 }, {
        ...headers(sessions.a1),
        "x-csrf-token": deriveCsrfToken(CSRF_SECRET, sessions.a2.id),
      }));
      expect(crossSession.statusCode).toBe(403);
      expect(repository.projects.get(own.id)?.name).toBe("A1");
      const updated = await server.inject(mutation("PUT", `/api/v1/projects/${own.id}`, { name: "Winner", schema: emptySchema, expectedRevision: 1 }));
      expect(updated.statusCode).toBe(200);
      expect(updated.json().project).toMatchObject({ name: "Winner", revision: 2 });
      const stale = await server.inject(mutation("PUT", `/api/v1/projects/${own.id}`, { name: "Stale", schema: emptySchema, expectedRevision: 1 }));
      expect(stale.statusCode).toBe(409);
      expect(stale.json().error).toMatchObject({ code: "PROJECT_REVISION_CONFLICT", details: { expectedRevision: 1, actualRevision: 2 } });
      const foreign = await server.inject(mutation("PUT", `/api/v1/projects/${own.id}`, { name: "Intrusion", schema: emptySchema, expectedRevision: 2 }, headers(sessions.b1)));
      expect(foreign.statusCode).toBe(404);
      expect(foreign.json().error.code).toBe("PROJECT_NOT_FOUND");
      expect(foreign.body).not.toContain("actualRevision");
    } finally { await server.close(); }
  });

  it("deletes only owned projects with 204 and maps repeated or foreign deletes to 404", async () => {
    const { server, repository } = setup();
    try {
      const own = await repository.create(USER_A, { id: randomUUID(), name: "A1", schema: emptySchema });
      const foreign = await repository.create(USER_B, { id: randomUUID(), name: "B1", schema: emptySchema });
      const deleted = await server.inject({ method: "DELETE", url: `/api/v1/projects/${own.id}`, headers: headers() });
      expect(deleted.statusCode).toBe(204);
      expect(deleted.body).toBe("");
      const repeated = await server.inject({ method: "DELETE", url: `/api/v1/projects/${own.id}`, headers: headers() });
      const foreignDelete = await server.inject({ method: "DELETE", url: `/api/v1/projects/${foreign.id}`, headers: headers() });
      expect(repeated.statusCode).toBe(404);
      expect(foreignDelete.statusCode).toBe(404);
      expect(repository.projects.get(foreign.id)?.ownerId).toBe(USER_B);
    } finally { await server.close(); }
  });

  it("allows credentialed PUT/DELETE preflights and withholds ACAO from disallowed origins", async () => {
    const { server } = setup();
    try {
      for (const method of ["PUT", "DELETE"]) {
        const response = await server.inject({
          method: "OPTIONS",
          url: "/api/v1/projects/example",
          headers: { origin: ORIGIN, "access-control-request-method": method, "access-control-request-headers": "content-type,x-csrf-token" },
        });
        expect(response.statusCode).toBe(204);
        expect(response.headers["access-control-allow-origin"]).toBe(ORIGIN);
        expect(response.headers["access-control-allow-credentials"]).toBe("true");
        expect(response.headers["access-control-allow-methods"]).toContain(method);
        expect(response.headers["access-control-allow-headers"]?.toLowerCase()).toContain("x-csrf-token");
      }
      const denied = await server.inject({ method: "OPTIONS", url: "/api/v1/projects/example", headers: { origin: "https://evil.example", "access-control-request-method": "PUT" } });
      expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    } finally { await server.close(); }
  });
});
