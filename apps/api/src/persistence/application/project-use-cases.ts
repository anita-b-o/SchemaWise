import { randomUUID } from "node:crypto";
import { persistenceError, projectError } from "../errors/project-error.js";
import type { PersistedSchema, Project, ProjectReplacement } from "../model/project.js";
import type { ProjectListResult, ProjectRepository } from "../ports/project-repository.js";
import { validateProjectReplacement } from "../validation/validate-project-draft.js";

export interface CreateProjectInput {
  readonly name: unknown;
  readonly schema: unknown;
}

export interface UpdateProjectInput extends CreateProjectInput {
  readonly expectedRevision: unknown;
}

export interface ListProjectsInput {
  readonly limit?: unknown;
  readonly offset?: unknown;
}

function validateProjectId(projectId: unknown): string {
  if (typeof projectId !== "string" || projectId.length === 0) {
    throw projectError("INVALID_PROJECT", "The project identifier is invalid.", { field: "projectId" });
  }
  return projectId;
}

function validateExpectedRevision(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw projectError("INVALID_PROJECT", "The expected revision must be a positive integer.", { field: "expectedRevision" });
  }
  return value as number;
}

function validatePagination(input: ListProjectsInput): { limit: number; offset: number } {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  if (!Number.isInteger(limit) || (limit as number) < 1) {
    throw projectError("INVALID_PROJECT", "The list limit must be a positive integer.", { field: "limit" });
  }
  if ((limit as number) > 100) {
    throw projectError("PROJECT_LIMIT_EXCEEDED", "The project list limit exceeds the maximum.", { limit: "listLimit", maximum: 100 });
  }
  if (!Number.isInteger(offset) || (offset as number) < 0) {
    throw projectError("INVALID_PROJECT", "The list offset must be a non-negative integer.", { field: "offset" });
  }
  return { limit: limit as number, offset: offset as number };
}

async function persist<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw persistenceError();
  }
}

export async function createProject(repository: ProjectRepository, input: CreateProjectInput): Promise<Project> {
  const replacement = validateProjectReplacement(input.name, input.schema);
  return persist(() => repository.create({ id: randomUUID(), ...replacement }));
}

export async function getProject(repository: ProjectRepository, projectId: unknown): Promise<Project> {
  const id = validateProjectId(projectId);
  const project = await persist(() => repository.findById(id));
  if (project === null) throw projectError("PROJECT_NOT_FOUND", "The project was not found.", { projectId: id });
  return project;
}

export async function listProjects(repository: ProjectRepository, input: ListProjectsInput = {}): Promise<ProjectListResult> {
  const query = validatePagination(input);
  return persist(() => repository.list(query));
}

export async function updateProject(repository: ProjectRepository, projectId: unknown, input: UpdateProjectInput): Promise<Project> {
  const id = validateProjectId(projectId);
  const expectedRevision = validateExpectedRevision(input.expectedRevision);
  const replacement: ProjectReplacement = validateProjectReplacement(input.name, input.schema);
  const result = await persist(() => repository.update(id, expectedRevision, replacement));
  if (result.kind === "not-found") throw projectError("PROJECT_NOT_FOUND", "The project was not found.", { projectId: id });
  if (result.kind === "revision-conflict") {
    throw projectError("PROJECT_REVISION_CONFLICT", "The project was modified after the requested revision.", {
      projectId: id,
      expectedRevision,
      actualRevision: result.actualRevision,
    });
  }
  return result.project;
}

export async function deleteProject(repository: ProjectRepository, projectId: unknown): Promise<void> {
  const id = validateProjectId(projectId);
  const result = await persist(() => repository.delete(id));
  if (result.kind === "not-found") throw projectError("PROJECT_NOT_FOUND", "The project was not found.", { projectId: id });
}

export type { PersistedSchema };
