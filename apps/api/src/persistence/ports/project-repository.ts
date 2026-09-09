import type { NewProject, Project, ProjectReplacement, ProjectSummary } from "../model/project.js";

export interface ProjectListQuery {
  readonly limit: number;
  readonly offset: number;
}

export interface ProjectListResult {
  readonly projects: readonly ProjectSummary[];
  readonly total: number;
}

export type ProjectUpdateResult =
  | { readonly kind: "updated"; readonly project: Project }
  | { readonly kind: "not-found" }
  | { readonly kind: "revision-conflict"; readonly actualRevision: number };

export type ProjectDeleteResult = { readonly kind: "deleted" } | { readonly kind: "not-found" };

export interface ProjectRepository {
  create(project: NewProject): Promise<Project>;
  findById(projectId: string): Promise<Project | null>;
  list(query: ProjectListQuery): Promise<ProjectListResult>;
  update(projectId: string, expectedRevision: number, replacement: ProjectReplacement): Promise<ProjectUpdateResult>;
  delete(projectId: string): Promise<ProjectDeleteResult>;
}
