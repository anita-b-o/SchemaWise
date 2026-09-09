import type { Pool } from "pg";
import type { Project, ProjectSummary } from "../model/project.js";
import type { NewProject, ProjectReplacement } from "../model/project.js";
import type { ProjectDeleteResult, ProjectListQuery, ProjectListResult, ProjectRepository, ProjectUpdateResult } from "../ports/project-repository.js";
import { validatePersistedSchema } from "../validation/validate-project-draft.js";

interface ProjectRow {
  readonly id: string;
  readonly name: string;
  readonly schema_json: unknown;
  readonly revision: number;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface CountRow {
  readonly total: string;
}

function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    schema: validatePersistedSchema(row.schema_json),
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSummary(row: ProjectRow): ProjectSummary {
  const project = mapProjectRow(row);
  return {
    id: project.id,
    name: project.name,
    relationName: project.schema.relation.name,
    attributeCount: project.schema.relation.attributes.length,
    functionalDependencyCount: project.schema.functionalDependencies.length,
    revision: project.revision,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

const PROJECT_COLUMNS = "id, name, schema_json, revision, created_at, updated_at";

export class PostgresProjectRepository implements ProjectRepository {
  constructor(private readonly pool: Pool) {}

  async create(project: NewProject): Promise<Project> {
    const result = await this.pool.query<ProjectRow>(
      `INSERT INTO projects (id, name, schema_json)
       VALUES ($1, $2, $3::jsonb)
       RETURNING ${PROJECT_COLUMNS}`,
      [project.id, project.name, JSON.stringify(project.schema)],
    );
    return mapProjectRow(result.rows[0]!);
  }

  async findById(projectId: string): Promise<Project | null> {
    const result = await this.pool.query<ProjectRow>(
      `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = $1`,
      [projectId],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapProjectRow(row);
  }

  async list(query: ProjectListQuery): Promise<ProjectListResult> {
    const countResult = await this.pool.query<CountRow>("SELECT count(*)::text AS total FROM projects");
    const rowsResult = await this.pool.query<ProjectRow>(
      `SELECT ${PROJECT_COLUMNS}
       FROM projects
       ORDER BY updated_at DESC, id ASC
       LIMIT $1 OFFSET $2`,
      [query.limit, query.offset],
    );
    return {
      projects: rowsResult.rows.map(mapSummary),
      total: Number(countResult.rows[0]!.total),
    };
  }

  async update(projectId: string, expectedRevision: number, replacement: ProjectReplacement): Promise<ProjectUpdateResult> {
    const result = await this.pool.query<ProjectRow>(
      `UPDATE projects
       SET name = $1,
           schema_json = $2::jsonb,
           revision = revision + 1,
           updated_at = now()
       WHERE id = $3 AND revision = $4
       RETURNING ${PROJECT_COLUMNS}`,
      [replacement.name, JSON.stringify(replacement.schema), projectId, expectedRevision],
    );
    const updated = result.rows[0];
    if (updated !== undefined) return { kind: "updated", project: mapProjectRow(updated) };

    const current = await this.pool.query<{ readonly revision: number }>(
      "SELECT revision FROM projects WHERE id = $1",
      [projectId],
    );
    const row = current.rows[0];
    return row === undefined ? { kind: "not-found" } : { kind: "revision-conflict", actualRevision: row.revision };
  }

  async delete(projectId: string): Promise<ProjectDeleteResult> {
    const result = await this.pool.query<{ readonly id: string }>(
      "DELETE FROM projects WHERE id = $1 RETURNING id",
      [projectId],
    );
    return result.rows[0] === undefined ? { kind: "not-found" } : { kind: "deleted" };
  }
}
