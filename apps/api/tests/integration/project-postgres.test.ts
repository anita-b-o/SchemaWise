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
  deleteProject,
  getProject,
  PostgresProjectRepository,
  updateProject,
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

async function migrateSchema(schema: string, direction: "up" | "down", count?: number): Promise<void> {
  await runner({
    databaseUrl: { connectionString: databaseUrl, options: `-c search_path=${schema}` },
    dir: migrationsDirectory,
    direction,
    count,
    migrationsTable: "pgmigrations",
    migrationsSchema: schema,
    schema,
    log: () => undefined,
  });
}

async function migrate(direction: "up" | "down", count?: number): Promise<void> {
  await migrateSchema(schemaName, direction, count);
}

async function insertUser(email = `${randomUUID()}@example.com`): Promise<string> {
  const id = randomUUID();
  await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'test-password-hash')", [id, email]);
  return id;
}

async function caught(operation: () => Promise<unknown>): Promise<unknown> {
  return operation().catch((error: unknown) => error);
}

describe.sequential("PostgreSQL project ownership persistence", () => {
  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    await migrate("up");
    pool = createProjectPool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
    repository = new PostgresProjectRepository(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE projects, users CASCADE");
  });

  afterAll(async () => {
    if (pool !== undefined) await closeProjectPool(pool);
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await adminPool.end();
  });

  it("applies 004 with required ownership, its FK/index, and rolls ownership down cleanly", async () => {
    const column = await pool.query<{ is_nullable: string; data_type: string }>(
      `SELECT is_nullable, data_type
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'projects' AND column_name = 'owner_id'`,
      [schemaName],
    );
    expect(column.rows).toEqual([{ is_nullable: "NO", data_type: "uuid" }]);

    const constraint = await pool.query<{ confdeltype: string }>(
      `SELECT confdeltype
       FROM pg_constraint
       WHERE conrelid = $1::regclass AND conname = 'projects_owner_id_fkey'`,
      [`${schemaName}.projects`],
    );
    expect(constraint.rows).toEqual([{ confdeltype: "r" }]);

    const index = await pool.query<{ indexdef: string }>(
      "SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = 'projects_owner_updated_id_idx'",
      [schemaName],
    );
    expect(index.rows).toHaveLength(1);
    expect(index.rows[0]!.indexdef).toContain("(owner_id, updated_at DESC, id)");

    await expect(repository.create(randomUUID(), newProject())).rejects.toMatchObject({ code: "23503" });
    const ownerId = await insertUser("constraints@example.com");
    await expect(
      pool.query(
        "INSERT INTO projects (id, owner_id, name, schema_json) VALUES ($1, $2, '   ', $3::jsonb)",
        [randomUUID(), ownerId, JSON.stringify(emptySchema)],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      pool.query(
        "INSERT INTO projects (id, owner_id, name, schema_json, revision) VALUES ($1, $2, 'Valid', $3::jsonb, 0)",
        [randomUUID(), ownerId, JSON.stringify(emptySchema)],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await closeProjectPool(pool);
    await migrate("down", 1);
    const removed = await adminPool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'projects' AND column_name = 'owner_id'`,
      [schemaName],
    );
    const removedIndex = await adminPool.query(
      "SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND indexname = 'projects_owner_updated_id_idx'",
      [schemaName],
    );
    expect(removed.rows).toHaveLength(0);
    expect(removedIndex.rows).toHaveLength(0);
    await migrate("up");
    pool = createProjectPool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
    repository = new PostgresProjectRepository(pool);
  });

  it("refuses 004 when legacy projects exist and preserves their data unchanged", async () => {
    const guardSchema = `schemawise_guard_${randomUUID().replaceAll("-", "")}`;
    await adminPool.query(`CREATE SCHEMA "${guardSchema}"`);
    try {
      await migrateSchema(guardSchema, "up", 3);
      const guardPool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${guardSchema}` });
      try {
        const legacyId = randomUUID();
        await guardPool.query(
          "INSERT INTO projects (id, name, schema_json) VALUES ($1, 'Legacy', $2::jsonb)",
          [legacyId, JSON.stringify(emptySchema)],
        );
        const error = await caught(() => migrateSchema(guardSchema, "up"));
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("projects table must be empty");
        expect((await guardPool.query("SELECT id, name FROM projects WHERE id = $1", [legacyId])).rows).toEqual([
          { id: legacyId, name: "Legacy" },
        ]);
        expect((await guardPool.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = 'projects' AND column_name = 'owner_id'`,
          [guardSchema],
        )).rows).toHaveLength(0);
      } finally {
        await guardPool.end();
      }
    } finally {
      await adminPool.query(`DROP SCHEMA IF EXISTS "${guardSchema}" CASCADE`);
    }
  });

  it("creates projects only for the supplied owner and preserves complete JSONB", async () => {
    const userA = await insertUser("a@example.com");
    const userB = await insertUser("b@example.com");
    const schema = {
      schemaVersion: 1 as const,
      relation: { name: "R", attributes: [{ id: "Attr_CASE-exact", name: "" }] },
      functionalDependencies: [{ left: [], right: ["Attr_CASE-exact"] }],
    };
    const projectA = await createProject(repository, userA, { name: "  A project  ", schema });
    const projectB = await createProject(repository, userB, { name: "B project", schema: emptySchema });
    expect(projectA).toMatchObject({ ownerId: userA, name: "A project", revision: 1, schema });
    expect(projectB.ownerId).toBe(userB);
    expect(projectA.createdAt).toBeInstanceOf(Date);
    expect(projectA.updatedAt).toBeInstanceOf(Date);
    expect((await pool.query<{ owner_id: string }>("SELECT owner_id FROM projects WHERE id = $1", [projectA.id])).rows[0]?.owner_id).toBe(userA);
  });

  it("scopes list rows, totals, deterministic ordering, and pagination by owner", async () => {
    const userA = await insertUser("a@example.com");
    const userB = await insertUser("b@example.com");
    const lowerId = "00000000-0000-4000-8000-000000000001";
    const higherId = "00000000-0000-4000-8000-000000000002";
    const bId = "00000000-0000-4000-8000-000000000003";
    await repository.create(userA, newProject(higherId, "A2"));
    await repository.create(userA, newProject(lowerId, "A1"));
    await repository.create(userB, newProject(bId, "B1"));
    await pool.query("UPDATE projects SET updated_at = '2026-09-09T12:00:00Z'");

    const firstPage = await repository.list(userA, { limit: 1, offset: 0 });
    const secondPage = await repository.list(userA, { limit: 1, offset: 1 });
    const bProjects = await repository.list(userB, { limit: 20, offset: 0 });
    expect(firstPage.total).toBe(2);
    expect(firstPage.projects.map(({ id }) => id)).toEqual([lowerId]);
    expect(secondPage.total).toBe(2);
    expect(secondPage.projects.map(({ id }) => id)).toEqual([higherId]);
    expect(bProjects.total).toBe(1);
    expect(bProjects.projects.map(({ id }) => id)).toEqual([bId]);
    expect(bProjects.projects[0]).not.toHaveProperty("ownerId");
  });

  it("makes foreign and nonexistent projects indistinguishable for get and update", async () => {
    const userA = await insertUser("a@example.com");
    const userB = await insertUser("b@example.com");
    const aProject = await repository.create(userA, newProject(randomUUID(), "A1"));
    const bProject = await repository.create(userB, newProject(randomUUID(), "B1"));
    const missingId = randomUUID();

    expect(await repository.findById(userA, aProject.id)).toEqual(aProject);
    expect(await repository.findById(userA, bProject.id)).toBeNull();
    expect(await repository.findById(userB, aProject.id)).toBeNull();
    expect(await repository.findById(userA, missingId)).toBeNull();

    const foreignGet = await caught(() => getProject(repository, userB, aProject.id));
    const missingGet = await caught(() => getProject(repository, userB, missingId));
    expect(foreignGet).toMatchObject({ code: "PROJECT_NOT_FOUND", message: "The project was not found.", details: { projectId: aProject.id } });
    expect(missingGet).toMatchObject({ code: "PROJECT_NOT_FOUND", message: "The project was not found.", details: { projectId: missingId } });

    const foreignUpdate = await repository.update(userB, aProject.id, aProject.revision, { name: "Intrusion", schema: emptySchema });
    const missingUpdate = await repository.update(userB, missingId, aProject.revision, { name: "Missing", schema: emptySchema });
    expect(foreignUpdate).toEqual({ kind: "not-found" });
    expect(missingUpdate).toEqual({ kind: "not-found" });
    expect(foreignUpdate).not.toHaveProperty("actualRevision");
    expect((await repository.findById(userA, aProject.id))?.name).toBe("A1");
  });

  it("updates and reports revision conflicts only within the owner's scope", async () => {
    const userA = await insertUser("a@example.com");
    const userB = await insertUser("b@example.com");
    const created = await repository.create(userA, newProject());
    await pool.query("UPDATE projects SET updated_at = now() - interval '1 minute' WHERE id = $1", [created.id]);
    const updated = await updateProject(repository, userA, created.id, { name: "Winner", schema: emptySchema, expectedRevision: 1 });
    expect(updated).toMatchObject({ ownerId: userA, name: "Winner", revision: 2 });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());

    await expect(updateProject(repository, userA, created.id, { name: "Stale", schema: emptySchema, expectedRevision: 1 })).rejects.toMatchObject({
      code: "PROJECT_REVISION_CONFLICT",
      details: { projectId: created.id, expectedRevision: 1, actualRevision: 2 },
    });
    const foreign = await caught(() => updateProject(repository, userB, created.id, { name: "Intrusion", schema: emptySchema, expectedRevision: 2 }));
    expect(foreign).toMatchObject({ code: "PROJECT_NOT_FOUND", message: "The project was not found.", details: { projectId: created.id } });
    expect((foreign as { details?: object }).details).not.toHaveProperty("actualRevision");
  });

  it("allows exactly one owner-scoped concurrent update and hides the result from another owner", async () => {
    const userA = await insertUser("a@example.com");
    const userB = await insertUser("b@example.com");
    const created = await repository.create(userA, newProject());
    const [left, right] = await Promise.all([
      repository.update(userA, created.id, created.revision, { name: "Concurrent A", schema: emptySchema }),
      repository.update(userA, created.id, created.revision, { name: "Concurrent B", schema: emptySchema }),
    ]);
    const outcomes = [left, right];
    expect(outcomes.filter(({ kind }) => kind === "updated")).toHaveLength(1);
    expect(outcomes.filter(({ kind }) => kind === "revision-conflict")).toEqual([
      { kind: "revision-conflict", actualRevision: 2 },
    ]);
    expect((await repository.findById(userA, created.id))?.revision).toBe(2);
    expect(await repository.update(userB, created.id, 2, { name: "Intrusion", schema: emptySchema })).toEqual({ kind: "not-found" });
  });

  it("scopes delete without global existence checks", async () => {
    const userA = await insertUser("a@example.com");
    const userB = await insertUser("b@example.com");
    const bProject = await repository.create(userB, newProject());
    const missingId = randomUUID();

    const foreignDelete = await caught(() => deleteProject(repository, userA, bProject.id));
    const missingDelete = await caught(() => deleteProject(repository, userA, missingId));
    expect(foreignDelete).toMatchObject({ code: "PROJECT_NOT_FOUND", message: "The project was not found.", details: { projectId: bProject.id } });
    expect(missingDelete).toMatchObject({ code: "PROJECT_NOT_FOUND", message: "The project was not found.", details: { projectId: missingId } });
    expect(await repository.findById(userB, bProject.id)).not.toBeNull();
    await expect(deleteProject(repository, userB, bProject.id)).resolves.toBeUndefined();
    expect(await repository.findById(userB, bProject.id)).toBeNull();
    expect(await repository.delete(userB, bProject.id)).toEqual({ kind: "not-found" });
  });

  it("enforces owner FK and restricts user deletion until owned projects are deleted", async () => {
    await expect(repository.create(randomUUID(), newProject())).rejects.toMatchObject({ code: "23503" });
    const userId = await insertUser("owner@example.com");
    const project = await repository.create(userId, newProject());
    await expect(pool.query("DELETE FROM users WHERE id = $1", [userId])).rejects.toMatchObject({ code: "23503" });
    expect(await repository.findById(userId, project.id)).not.toBeNull();
    await repository.delete(userId, project.id);
    await expect(pool.query("DELETE FROM users WHERE id = $1", [userId])).resolves.toMatchObject({ rowCount: 1 });
  });
});
