import type { PersistedSchemaDto, ProjectDto } from "../../api/schemawise-contracts";
import type { SchemaDraft } from "../workspace/workspace-reducer";

export interface ProjectSnapshot { readonly name: string; readonly schema: PersistedSchemaDto; }
export interface ProjectSession {
  readonly projectId?: string;
  readonly name: string;
  readonly serverRevision?: number;
  readonly savedSnapshot?: ProjectSnapshot;
  readonly savedDraftRevision?: number;
  readonly syncUnavailable: boolean;
}

export const initialProjectSession: ProjectSession = { name: "Untitled project", syncUnavailable: false };

export function draftToPersistedSchema(draft: SchemaDraft): PersistedSchemaDto {
  return { schemaVersion: 1, relation: { name: draft.relationName, attributes: draft.attributes.map(({ id, name }) => ({ id, name })) }, functionalDependencies: draft.functionalDependencies.map(({ left, right }) => ({ left: [...left], right: [...right] })) };
}

export function persistedSchemaToDraft(schema: PersistedSchemaDto): SchemaDraft {
  return { relationName: schema.relation.name, attributes: schema.relation.attributes.map(({ id, name }) => ({ id, name })), functionalDependencies: schema.functionalDependencies.map(({ left, right }) => ({ left: [...left], right: [...right] })) };
}

export function sessionFromProject(project: ProjectDto, draftRevision: number): ProjectSession {
  return { projectId: project.id, name: project.name, serverRevision: project.revision, savedSnapshot: { name: project.name, schema: project.schema }, savedDraftRevision: draftRevision, syncUnavailable: false };
}

export function isProjectDirty(session: ProjectSession, draft: SchemaDraft): boolean {
  if (!session.savedSnapshot) return session.name !== "Untitled project" || draft.relationName !== "" || draft.attributes.length > 0 || draft.functionalDependencies.length > 0;
  return JSON.stringify({ name: session.name, schema: draftToPersistedSchema(draft) }) !== JSON.stringify(session.savedSnapshot);
}
