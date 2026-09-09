import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "pg";
import { runner } from "node-pg-migrate";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeProjectPool,
  createProject,
  createProjectPool,
  PostgresProjectRepository,
  type NewProject,
} from "../../src/index.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
  throw new Error("DATABASE_URL must point to an isolated PostgreSQL test database");
}

const schemaName = `schemawise_test_${randomUUID().replaceAll("-", "")}`;
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");
const adminPool = new Pool({ connectionString: databaseUrl });
let pool: Pool;
let repository: PostgresProjectRepository;

const emptySchema = {
  schemaVersion: 1 as const,
  relation: { name: "", attributes: [] },
  functionalDependencies: [],
};

function newProject(id = randomUUID(), name = "Draft"): NewProject {
  return { id, name, schema: emptySchema };
}

async function migrate(direction: "up" | "down"): Promise<void> {
  await runner({
    databaseUrl: { connectionString: databaseUrl, options: `-c search_path=${schemaName}` },
    dir: migrationsDirectory,
    direction,
    count: direction === "down" ? 1 : undefined,
    migrationsTable: "pgmigrations",
    migrationsSchema: schemaName,
    schema: schemaName,
    log: () => undefined,
  });
}

describe.sequential("PostgreSQL project persistence", () => {
  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    await migrate("up");
    pool = createProjectPool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
    repository = new PostgresProjectRepository(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE projects");
  });

  afterAll(async () => {
    if (pool !== undefined) await closeProjectPool(pool);
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await adminPool.end();
  });

  it("applies the migration, enforces constraints, rolls back, and reapplies", async () => {
    const table = await pool.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'projects'", [schemaName]);
    expect(table.rows).toHaveLength(1);

    await expect(pool.query("INSERT INTO projects (id, name, schema_json) VALUES ($1, '   ', $2::jsonb)", [randomUUID(), JSON.stringify(emptySchema)])).rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("INSERT INTO projects (id, name, schema_json, revision) VALUES ($1, 'Valid', $2::jsonb, 0)", [randomUUID(), JSON.stringify(emptySchema)])).rejects.toMatchObject({ code: "23514" });

    await closeProjectPool(pool);
    await migrate("down");
    const absent = await adminPool.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'projects'", [schemaName]);
    expect(absent.rows).toHaveLength(0);
    await migrate("up");
    pool = createProjectPool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
    repository = new PostgresProjectRepository(pool);
  });

  it("creates a project with generated UUID, revision, timestamps, and an incomplete draft", async () => {
    const project = await createProject(repository, { name: "  Incomplete  ", schema: emptySchema });
    expect(project.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(project.name).toBe("Incomplete");
    expect(project.revision).toBe(1);
    expect(project.createdAt).toBeInstanceOf(Date);
    expect(project.updatedAt).toBeInstanceOf(Date);
    expect(project.schema.schemaVersion).toBe(1);
    expect(project.schema.relation.attributes).toEqual([]);
  });

  it("preserves attribute IDs and the complete JSONB schema", async () => {
    const schema = {
      schemaVersion: 1 as const,
      relation: { name: "R", attributes: [{ id: "Attr_CASE-exact", name: "" }] },
      functionalDependencies: [{ left: [], right: ["Attr_CASE-exact"] }],
    };
    const created = await repository.create({ id: randomUUID(), name: "Draft", schema });
    const found = await repository.findById(created.id);
    expect(found?.schema).toEqual(schema);
    expect(found?.schema.relation.attributes[0]?.id).toBe("Attr_CASE-exact");
    expect(await repository.findById(randomUUID())).toBeNull();
  });

  it("lists empty results, total, deterministic ordering, and pagination", async () => {
    expect(await repository.list({ limit: 20, offset: 0 })).toEqual({ projects: [], total: 0 });
    const lowerId = "00000000-0000-4000-8000-000000000001";
    const higherId = "00000000-0000-4000-8000-000000000002";
    await repository.create(newProject(higherId, "Second"));
    await repository.create(newProject(lowerId, "First"));
    await pool.query("UPDATE projects SET updated_at = '2026-09-09T12:00:00Z'");

    const firstPage = await repository.list({ limit: 1, offset: 0 });
    const secondPage = await repository.list({ limit: 1, offset: 1 });
    expect(firstPage.total).toBe(2);
    expect(firstPage.projects.map(({ id }) => id)).toEqual([lowerId]);
    expect(secondPage.total).toBe(2);
    expect(secondPage.projects.map(({ id }) => id)).toEqual([higherId]);
  });

  it("updates name and schema atomically, increments revision, and advances updatedAt", async () => {
    const created = await repository.create(newProject());
    await pool.query("UPDATE projects SET updated_at = now() - interval '1 minute' WHERE id = $1", [created.id]);
    const before = await repository.findById(created.id);
    const replacement = {
      name: "Updated",
      schema: { ...emptySchema, relation: { name: "R2", attributes: [{ id: "a", name: "A" }] } },
    };
    const result = await repository.update(created.id, 1, replacement);
    expect(result.kind).toBe("updated");
    if (result.kind !== "updated") return;
    expect(result.project.name).toBe("Updated");
    expect(result.project.schema).toEqual(replacement.schema);
    expect(result.project.revision).toBe(2);
    expect(result.project.createdAt).toEqual(created.createdAt);
    expect(result.project.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());
  });

  it("returns stale revision conflicts with the actual revision and does not overwrite", async () => {
    const created = await repository.create(newProject());
    const first = await repository.update(created.id, 1, { name: "Winner", schema: emptySchema });
    expect(first.kind).toBe("updated");
    const stale = await repository.update(created.id, 1, { name: "Loser", schema: emptySchema });
    expect(stale).toEqual({ kind: "revision-conflict", actualRevision: 2 });
    expect((await repository.findById(created.id))?.name).toBe("Winner");
    expect(await repository.update(randomUUID(), 1, { name: "Missing", schema: emptySchema })).toEqual({ kind: "not-found" });
  });

  it("allows exactly one of two concurrent updates with the same expected revision", async () => {
    const created = await repository.create(newProject());
    const [left, right] = await Promise.all([
      repository.update(created.id, created.revision, { name: "Concurrent A", schema: emptySchema }),
      repository.update(created.id, created.revision, { name: "Concurrent B", schema: emptySchema }),
    ]);
    const outcomes = [left, right];
    expect(outcomes.filter(({ kind }) => kind === "updated")).toHaveLength(1);
    const conflicts = outcomes.filter((outcome) => outcome.kind === "revision-conflict");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toEqual({ kind: "revision-conflict", actualRevision: 2 });
    expect((await repository.findById(created.id))?.revision).toBe(2);
  });

  it("hard-deletes and reports a repeated delete as not found", async () => {
    const created = await repository.create(newProject());
    expect(await repository.delete(created.id)).toEqual({ kind: "deleted" });
    expect(await repository.findById(created.id)).toBeNull();
    expect(await repository.delete(created.id)).toEqual({ kind: "not-found" });
  });
});
