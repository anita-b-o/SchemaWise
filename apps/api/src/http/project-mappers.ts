import type { Project, ProjectSummary } from "../persistence/model/project.js";

export function toProjectResponseDto(project: Project) {
  return {
    id: project.id,
    name: project.name,
    schema: project.schema,
    revision: project.revision,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export function toProjectSummaryDto(project: ProjectSummary) {
  return {
    id: project.id,
    name: project.name,
    relationName: project.relationName,
    attributeCount: project.attributeCount,
    functionalDependencyCount: project.functionalDependencyCount,
    revision: project.revision,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
