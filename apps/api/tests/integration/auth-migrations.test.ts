import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "pg";
import { runner } from "node-pg-migrate";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
  throw new Error("DATABASE_URL must point to an isolated PostgreSQL test database");
}

const schemaName = `schemawise_auth_test_${randomUUID().replaceAll("-", "")}`;
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");
const adminPool = new Pool({ connectionString: databaseUrl });
let pool: Pool;

async function migrate(direction: "up" | "down", count?: number): Promise<void> {
  await runner({
    databaseUrl: { connectionString: databaseUrl, options: `-c search_path=${schemaName}` },
    dir: migrationsDirectory,
    direction,
    count: direction === "down" ? count ?? 1 : undefined,
    migrationsTable: "pgmigrations",
    migrationsSchema: schemaName,
    schema: schemaName,
    log: () => undefined,
  });
}

async function insertUser(email = "person@example.com", passwordHash: string | null = "fake-phc-hash"): Promise<string> {
  const id = randomUUID();
  await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)", [id, email, passwordHash]);
  return id;
}

describe.sequential("PostgreSQL auth migrations", () => {
  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    await migrate("up");
    pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE users CASCADE");
  });

  afterAll(async () => {
    if (pool !== undefined) await pool.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await adminPool.end();
  });

  it("applies and independently rolls back sessions and users, then reapplies them", async () => {
    const present = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ('users', 'sessions') ORDER BY table_name",
      [schemaName],
    );
    expect(present.rows.map(({ table_name }) => table_name)).toEqual(["sessions", "users"]);

    await pool.end();
    await migrate("down");
    const afterSessionsDown = await adminPool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ('users', 'sessions') ORDER BY table_name",
      [schemaName],
    );
    expect(afterSessionsDown.rows.map(({ table_name }) => table_name)).toEqual(["users"]);

    await migrate("down");
    const afterUsersDown = await adminPool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ('projects', 'users', 'sessions') ORDER BY table_name",
      [schemaName],
    );
    expect(afterUsersDown.rows.map(({ table_name }) => table_name)).toEqual(["projects"]);

    await migrate("up");
    pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
  });

  it("enforces nonblank unique canonical email", async () => {
    await insertUser("person@example.com");
    await expect(insertUser("person@example.com")).rejects.toMatchObject({ code: "23505" });
    await expect(insertUser("   ")).rejects.toMatchObject({ code: "23514" });
  });

  it("requires password_hash", async () => {
    await expect(insertUser("person@example.com", null)).rejects.toMatchObject({ code: "23502" });
  });

  it("persists unique bytea token hashes and exact expiry", async () => {
    const userId = await insertUser();
    const expiresAt = new Date("2026-10-09T12:00:00.123Z");
    const tokenHash = Buffer.alloc(32, 0xab);
    await pool.query("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)", [randomUUID(), userId, tokenHash, expiresAt]);
    const stored = await pool.query<{ token_hash: Buffer; expires_at: Date }>("SELECT token_hash, expires_at FROM sessions");
    expect(stored.rows[0]?.token_hash).toEqual(tokenHash);
    expect(stored.rows[0]?.expires_at).toEqual(expiresAt);
    await expect(
      pool.query("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)", [randomUUID(), userId, tokenHash, expiresAt]),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("enforces the session user foreign key", async () => {
    await expect(
      pool.query("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)", [randomUUID(), randomUUID(), Buffer.alloc(32), NOW_PLUS_DAY]),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("cascades session deletion when its user is deleted", async () => {
    const userId = await insertUser();
    await pool.query("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)", [randomUUID(), userId, Buffer.alloc(32), NOW_PLUS_DAY]);
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    expect((await pool.query("SELECT id FROM sessions")).rows).toHaveLength(0);
  });

  it("creates the user, expiry, and unique token lookup indexes", async () => {
    const indexes = await pool.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename IN ('users', 'sessions')",
      [schemaName],
    );
    const names = indexes.rows.map(({ indexname }) => indexname);
    expect(names).toContain("users_email_key");
    expect(names).toContain("sessions_token_hash_key");
    expect(names).toContain("sessions_user_id_idx");
    expect(names).toContain("sessions_expires_at_idx");
  });
});

const NOW_PLUS_DAY = new Date("2026-09-10T12:00:00.000Z");
