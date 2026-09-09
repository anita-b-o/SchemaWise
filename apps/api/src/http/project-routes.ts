import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthRuntime } from "../auth/runtime/auth-runtime.js";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "../persistence/application/project-use-cases.js";
import { projectError } from "../persistence/errors/project-error.js";
import type { ProjectRepository } from "../persistence/ports/project-repository.js";
import { resolveAuthenticatedUser } from "./auth-context.js";
import { assertAllowedRequestOrigin, assertValidCsrfToken } from "./auth-security.js";
import { toProjectResponseDto, toProjectSummaryDto } from "./project-mappers.js";

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = [...keys].sort();
  const actual = Object.keys(record).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function createDto(body: unknown): { name: unknown; schema: unknown } {
  if (!isRecord(body) || !exactKeys(body, ["name", "schema"])) {
    throw projectError("INVALID_PROJECT", "The project request is invalid.");
  }
  return { name: body.name, schema: body.schema };
}

function updateDto(body: unknown): { name: unknown; schema: unknown; expectedRevision: unknown } {
  if (!isRecord(body) || !exactKeys(body, ["name", "schema", "expectedRevision"])) {
    throw projectError("INVALID_PROJECT", "The project request is invalid.");
  }
  return { name: body.name, schema: body.schema, expectedRevision: body.expectedRevision };
}

function projectId(params: unknown): string {
  const id = isRecord(params) ? params.projectId : undefined;
  if (typeof id !== "string" || !UUID_V4_PATTERN.test(id)) {
    throw projectError("INVALID_PROJECT", "The project identifier is invalid.", { field: "projectId" });
  }
  return id;
}

function integerQuery(value: unknown, fallback: number, field: "limit" | "offset"): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value)) {
    throw projectError("INVALID_PROJECT", `The list ${field} must be an integer.`, { field });
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw projectError("INVALID_PROJECT", `The list ${field} must be an integer.`, { field });
  }
  return parsed;
}

function pagination(query: unknown): { limit: number; offset: number } {
  if (!isRecord(query) || Object.keys(query).some((key) => key !== "limit" && key !== "offset")) {
    throw projectError("INVALID_PROJECT", "The project list query is invalid.");
  }
  return {
    limit: integerQuery(query.limit, 20, "limit"),
    offset: integerQuery(query.offset, 0, "offset"),
  };
}

async function secureMutation(
  request: FastifyRequest,
  auth: AuthRuntime,
  csrfSecret: string,
  allowedOrigins: readonly string[],
) {
  const context = await resolveAuthenticatedUser(request, auth);
  assertAllowedRequestOrigin(request, allowedOrigins);
  assertValidCsrfToken(request.headers["x-csrf-token"], csrfSecret, context.sessionId);
  return context;
}

export function registerProjectRoutes(
  server: FastifyInstance,
  auth: AuthRuntime,
  repository: ProjectRepository,
  csrfSecret: string,
  allowedOrigins: readonly string[],
): void {
  server.post("/api/v1/projects", async (request, reply) => {
    const context = await secureMutation(request, auth, csrfSecret, allowedOrigins);
    const project = await createProject(repository, context.userId, createDto(request.body));
    return reply.code(201).send({ project: toProjectResponseDto(project) });
  });

  server.get("/api/v1/projects", async (request, reply) => {
    const context = await resolveAuthenticatedUser(request, auth);
    const query = pagination(request.query);
    const result = await listProjects(repository, context.userId, query);
    return reply.code(200).send({
      projects: result.projects.map(toProjectSummaryDto),
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    });
  });

  server.get("/api/v1/projects/:projectId", async (request, reply) => {
    const context = await resolveAuthenticatedUser(request, auth);
    const project = await getProject(repository, context.userId, projectId(request.params));
    return reply.code(200).send({ project: toProjectResponseDto(project) });
  });

  server.put("/api/v1/projects/:projectId", async (request, reply) => {
    const context = await secureMutation(request, auth, csrfSecret, allowedOrigins);
    const project = await updateProject(repository, context.userId, projectId(request.params), updateDto(request.body));
    return reply.code(200).send({ project: toProjectResponseDto(project) });
  });

  server.delete("/api/v1/projects/:projectId", async (request, reply) => {
    const context = await secureMutation(request, auth, csrfSecret, allowedOrigins);
    await deleteProject(repository, context.userId, projectId(request.params));
    return reply.code(204).send();
  });
}
