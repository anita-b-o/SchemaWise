import type { CreateProjectRequestDto, ProjectDto, ProjectErrorCode, ProjectListResponseDto, UpdateProjectRequestDto } from "./schemawise-contracts";
import { HttpApiError, httpRequest, jsonRequest } from "./http-api";

export { HttpApiError as ProjectApiError };
export interface ProjectApi {
  createProject(input: CreateProjectRequestDto, csrfToken: string): Promise<ProjectDto>;
  listProjects(limit?: number, offset?: number): Promise<ProjectListResponseDto>;
  getProject(projectId: string, signal?: AbortSignal): Promise<ProjectDto>;
  updateProject(projectId: string, input: UpdateProjectRequestDto, csrfToken: string): Promise<ProjectDto>;
  deleteProject(projectId: string, csrfToken: string): Promise<void>;
}

export const projectApi: ProjectApi = {
  async createProject(input, csrfToken) { return (await httpRequest<{ project: ProjectDto }, ProjectErrorCode | "UNAUTHENTICATED" | "INVALID_CSRF_TOKEN">("/projects", jsonRequest("POST", input, csrfToken))).project; },
  listProjects: (limit = 20, offset = 0) => httpRequest<ProjectListResponseDto, ProjectErrorCode | "UNAUTHENTICATED">(`/projects?limit=${limit}&offset=${offset}`, { credentials: "include" }),
  async getProject(projectId, signal) { return (await httpRequest<{ project: ProjectDto }, ProjectErrorCode | "UNAUTHENTICATED">(`/projects/${encodeURIComponent(projectId)}`, { credentials: "include", ...(signal ? { signal } : {}) })).project; },
  async updateProject(projectId, input, csrfToken) { return (await httpRequest<{ project: ProjectDto }, ProjectErrorCode | "UNAUTHENTICATED" | "INVALID_CSRF_TOKEN">(`/projects/${encodeURIComponent(projectId)}`, jsonRequest("PUT", input, csrfToken))).project; },
  deleteProject: (projectId, csrfToken) => httpRequest<void, ProjectErrorCode | "UNAUTHENTICATED" | "INVALID_CSRF_TOKEN">(`/projects/${encodeURIComponent(projectId)}`, { method: "DELETE", credentials: "include", headers: { "X-CSRF-Token": csrfToken } }),
};
