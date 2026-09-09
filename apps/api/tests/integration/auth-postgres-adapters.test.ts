import { randomUUID, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "pg";
import { runner } from "node-pg-migrate";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  Argon2idPasswordHasher,
  authenticateSession,
  closeProjectPool,
  createProjectPool,
  CryptoSessionTokenGenerator,
  loginUser,
  logout,
  PostgresAuthRegistrationRepository,
  PostgresSessionRepository,
  PostgresUserRepository,
  registerUser,
  type Clock,
  type Session,
  type User,
} from "../../src/index.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
  throw new Error("DATABASE_URL must point to an isolated PostgreSQL test database");
}

const schemaName = `schemawise_auth_adapters_${randomUUID().replaceAll("-", "")}`;
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");
const adminPool = new Pool({ connectionString: databaseUrl });
const NOW = new Date("2026-09-09T12:00:00.000Z");
const ACTIVE_EXPIRY = new Date("2026-10-09T12:00:00.000Z");
const clock: Clock = { now: () => NOW };
let pool: Pool;
let users: PostgresUserRepository;
let sessions: PostgresSessionRepository;
let registration: PostgresAuthRegistrationRepository;

function user(overrides: Partial<User> = {}): User {
  return {
    id: randomUUID(),
    email: `person-${randomUUID()}@example.com`,
    passwordHash: "$argon2id$test-fixture",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function session(userId: string, overrides: Partial<Session> = {}): Session {
  return {
    id: randomUUID(),
    userId,
    tokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
    createdAt: NOW,
    expiresAt: ACTIVE_EXPIRY,
    ...overrides,
  };
}

async function migrate(): Promise<void> {
  await runner({
    databaseUrl: { connectionString: databaseUrl, options: `-c search_path=${schemaName}` },
    dir: migrationsDirectory,
    direction: "up",
    migrationsTable: "pgmigrations",
    migrationsSchema: schemaName,
    schema: schemaName,
    log: () => undefined,
  });
}

describe.sequential("PostgreSQL authentication adapters", () => {
  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    await migrate();
    pool = createProjectPool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
    users = new PostgresUserRepository(pool);
    sessions = new PostgresSessionRepository(pool);
    registration = new PostgresAuthRegistrationRepository(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE users CASCADE");
  });

  afterAll(async () => {
    if (pool !== undefined) await closeProjectPool(pool);
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await adminPool.end();
  });

  it("creates and explicitly maps users by canonical email and id", async () => {
    const expected = user({ email: "canonical@example.com" });
    await expect(users.create(expected)).resolves.toEqual({ kind: "created" });
    await expect(users.findByCanonicalEmail(expected.email)).resolves.toEqual(expected);
    await expect(users.findById(expected.id)).resolves.toEqual(expected);
    await expect(users.findByCanonicalEmail("absent@example.com")).resolves.toBeNull();
  });

  it("maps only the PostgreSQL email unique violation to duplicate-email", async () => {
    const first = user({ email: "duplicate@example.com" });
    await users.create(first);
    await expect(users.create(user({ email: first.email }))).resolves.toEqual({ kind: "duplicate-email" });
    await expect(users.create({ ...user(), id: first.id })).rejects.toMatchObject({ code: "23505" });
  });

  it("round-trips bytea token hashes, filters expiry, and deletes idempotently", async () => {
    const expectedUser = user();
    await users.create(expectedUser);
    const active = session(expectedUser.id);
    const expired = session(expectedUser.id, { expiresAt: NOW });
    await sessions.create(active);
    await sessions.create(expired);

    const stored = await pool.query<{ token_hash: Buffer }>("SELECT token_hash FROM sessions WHERE id = $1", [active.id]);
    expect(stored.rows[0]?.token_hash).toEqual(Buffer.from(active.tokenHash, "hex"));
    await expect(sessions.findActiveByTokenHash(active.tokenHash, NOW)).resolves.toEqual(active);
    await expect(sessions.findActiveByTokenHash(expired.tokenHash, NOW)).resolves.toBeNull();
    await sessions.deleteByTokenHash(active.tokenHash);
    await expect(sessions.findActiveByTokenHash(active.tokenHash, NOW)).resolves.toBeNull();
    await expect(sessions.deleteByTokenHash(active.tokenHash)).resolves.toBeUndefined();
  });

  it("commits user and session together on successful registration", async () => {
    const expectedUser = user();
    const expectedSession = session(expectedUser.id);
    await expect(registration.createUserWithSession(expectedUser, expectedSession)).resolves.toEqual({ kind: "created" });
    await expect(users.findById(expectedUser.id)).resolves.toEqual(expectedUser);
    await expect(sessions.findActiveByTokenHash(expectedSession.tokenHash, NOW)).resolves.toEqual(expectedSession);
  });

  it("rolls back a duplicate email without creating an extra session", async () => {
    const existing = user({ email: "registered@example.com" });
    await users.create(existing);
    const duplicate = user({ email: existing.email });
    await expect(registration.createUserWithSession(duplicate, session(duplicate.id))).resolves.toEqual({ kind: "duplicate-email" });
    expect((await pool.query("SELECT id FROM users")).rows).toHaveLength(1);
    expect((await pool.query("SELECT id FROM sessions")).rows).toHaveLength(0);
  });

  it("rolls back the inserted user when the session insert violates its foreign key", async () => {
    const candidate = user({ email: "atomicity@example.com" });
    const invalidSession = session(randomUUID());
    await expect(registration.createUserWithSession(candidate, invalidSession)).rejects.toMatchObject({ code: "23503" });
    expect((await pool.query("SELECT id FROM users WHERE id = $1 OR email = $2", [candidate.id, candidate.email])).rows).toHaveLength(0);
    expect((await pool.query("SELECT id FROM sessions")).rows).toHaveLength(0);
  });

  it("runs register, login, authenticate, and logout with real adapters", async () => {
    const passwordHasher = new Argon2idPasswordHasher();
    const sessionTokenGenerator = new CryptoSessionTokenGenerator();
    const registrationDependencies = { registrationRepository: registration, passwordHasher, sessionTokenGenerator, clock };
    const loginDependencies = { userRepository: users, sessionRepository: sessions, passwordHasher, sessionTokenGenerator, clock };
    const sessionDependencies = { userRepository: users, sessionRepository: sessions, sessionTokenGenerator, clock };
    const password = "  contraseña segura 🔐  ";

    const registered = await registerUser(registrationDependencies, { email: "  AUTH@Example.COM ", password });
    const storedUser = await users.findById(registered.user.id);
    expect(storedUser?.email).toBe("auth@example.com");
    expect(storedUser?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(storedUser?.passwordHash).not.toContain(password);
    expect(await passwordHasher.verify(storedUser!.passwordHash, password)).toBe(true);

    const registeredHash = await sessionTokenGenerator.hash(registered.session.token);
    const registeredSession = await sessions.findActiveByTokenHash(registeredHash, NOW);
    expect(registeredSession).not.toBeNull();
    const rawSessionRows = await pool.query<{ token_hash: Buffer }>("SELECT token_hash FROM sessions WHERE id = $1", [registeredSession!.id]);
    expect(rawSessionRows.rows[0]?.token_hash).toEqual(Buffer.from(registeredHash, "hex"));
    expect(rawSessionRows.rows[0]?.token_hash).not.toEqual(Buffer.from(registered.session.token, "utf8"));

    const loggedIn = await loginUser(loginDependencies, { email: "auth@example.com", password });
    expect(loggedIn.user).toEqual(registered.user);
    expect(loggedIn.session.token).not.toBe(registered.session.token);
    expect((await pool.query("SELECT id FROM sessions WHERE user_id = $1", [registered.user.id])).rows).toHaveLength(2);
    await expect(authenticateSession(sessionDependencies, loggedIn.session.token)).resolves.toEqual({
      user: registered.user,
      sessionId: loggedIn.session.id,
    });
    await logout({ sessionRepository: sessions, sessionTokenGenerator }, loggedIn.session.token);
    await expect(authenticateSession(sessionDependencies, loggedIn.session.token)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("sanitizes a malformed stored PHC hash as AUTH_INTERNAL_ERROR", async () => {
    const broken = user({ email: "broken@example.com", passwordHash: "malformed PHC with internal detail" });
    await users.create(broken);
    const error = await loginUser(
      {
        userRepository: users,
        sessionRepository: sessions,
        passwordHasher: new Argon2idPasswordHasher(),
        sessionTokenGenerator: new CryptoSessionTokenGenerator(),
        clock,
      },
      { email: broken.email, password: "wrong password" },
    ).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "AUTH_INTERNAL_ERROR", message: "The authentication operation failed." });
    expect(JSON.stringify(error)).not.toContain("malformed PHC");
  });

  it("sanitizes a real PostgreSQL infrastructure failure as AUTH_INTERNAL_ERROR", async () => {
    const closedPool = createProjectPool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
    await closeProjectPool(closedPool);
    const error = await loginUser(
      {
        userRepository: new PostgresUserRepository(closedPool),
        sessionRepository: sessions,
        passwordHasher: new Argon2idPasswordHasher(),
        sessionTokenGenerator: new CryptoSessionTokenGenerator(),
        clock,
      },
      { email: "person@example.com", password: "wrong password" },
    ).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "AUTH_INTERNAL_ERROR", message: "The authentication operation failed." });
    expect(JSON.stringify(error)).not.toContain(databaseUrl);
  });
});
