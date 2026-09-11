import type { PersistedSchemaDto, ProjectDto } from "../../api/schemawise-contracts";
import type { SchemaDraft } from "../workspace/workspace-reducer";

export interface ProjectSnapshot { readonly name: string; readonly schema: PersistedSchemaDto; }
export interface ProjectSession {
  readonly loadedProjectId?: string;
  readonly name: string;
  readonly serverRevision?: number;
  readonly persistedSnapshot?: ProjectSnapshot;
  readonly syncUnavailable: boolean;
}

export const initialProjectSession: ProjectSession = { name: "Untitled project", syncUnavailable: false };

export function draftToPersistedSchema(draft: SchemaDraft): PersistedSchemaDto {
  return { schemaVersion: 1, relation: { name: draft.relationName, attributes: draft.attributes.map(({ id, name }) => ({ id, name })) }, functionalDependencies: draft.functionalDependencies.map(({ left, right }) => ({ left: [...left], right: [...right] })) };
}

export function persistedSchemaToDraft(schema: PersistedSchemaDto): SchemaDraft {
  return { relationName: schema.relation.name, attributes: schema.relation.attributes.map(({ id, name }) => ({ id, name })), functionalDependencies: schema.functionalDependencies.map(({ left, right }) => ({ left: [...left], right: [...right] })) };
}

export function sessionFromProject(project: ProjectDto): ProjectSession {
  return { loadedProjectId: project.id, name: project.name, serverRevision: project.revision, persistedSnapshot: { name: project.name, schema: project.schema }, syncUnavailable: false };
}

export function isProjectDirty(session: ProjectSession, draft: SchemaDraft): boolean {
  if (!session.persistedSnapshot) return session.name !== "Untitled project" || draft.relationName !== "" || draft.attributes.length > 0 || draft.functionalDependencies.length > 0;
  return JSON.stringify({ name: session.name, schema: draftToPersistedSchema(draft) }) !== JSON.stringify(session.persistedSnapshot);
}
