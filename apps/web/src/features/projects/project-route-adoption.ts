import type { ProjectDto } from "../../api/schemawise-contracts";

const adoptionIntents = new Map<string, ProjectDto>();

export function recordProjectAdoption(project: ProjectDto): string {
  const token = crypto.randomUUID();
  adoptionIntents.set(token, project);
  return token;
}

export function peekProjectAdoption(token: string | undefined, projectId: string): ProjectDto | undefined {
  if (!token) return undefined;
  const project = adoptionIntents.get(token);
  return project?.id.toLowerCase() === projectId.toLowerCase() ? project : undefined;
}

export function consumeProjectAdoption(token: string | undefined): void {
  if (token) adoptionIntents.delete(token);
}
