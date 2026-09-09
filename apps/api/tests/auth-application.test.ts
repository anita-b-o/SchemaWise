import { describe, expect, it } from "vitest";
import {
  AuthApplicationError,
  authenticateSession,
  loginUser,
  logout,
  normalizeEmail,
  registerUser,
  validateLoginPassword,
  validateRegistrationPassword,
  type AuthRegistrationRepository,
  type Clock,
  type PasswordHasher,
  type Session,
  type SessionRepository,
  type SessionTokenGenerator,
  type User,
  type UserRepository,
} from "../src/index.js";

const NOW = new Date("2026-09-09T12:00:00.000Z");
const RAW_TOKEN = "A".repeat(43);
const TOKEN_HASH = "a".repeat(64);
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class FakeClock implements Clock {
  constructor(private readonly value = NOW) {}
  now(): Date { return new Date(this.value); }
}

class FakePasswordHasher implements PasswordHasher {
  readonly hashed: string[] = [];
  readonly verified: Array<{ hash: string; password: string }> = [];
  readonly dummyVerified: string[] = [];
  hashFailure = false;

  async hash(password: string): Promise<string> {
    this.hashed.push(password);
    if (this.hashFailure) throw new Error("secret adapter detail");
    return `fake-hash:${password}`;
  }

  async verify(hash: string, password: string): Promise<boolean> {
    this.verified.push({ hash, password });
    return hash === `fake-hash:${password}`;
  }

  async dummyVerify(password: string): Promise<void> {
    this.dummyVerified.push(password);
  }
}

class FakeTokenGenerator implements SessionTokenGenerator {
  private sequence = 0;

  async generate(): Promise<{ rawToken: string; tokenHash: string }> {
    const suffix = String.fromCharCode(65 + this.sequence++);
    return { rawToken: suffix.repeat(43), tokenHash: suffix.toLowerCase().repeat(64) };
  }

  async hash(rawToken: string): Promise<string> {
    return rawToken[0]!.toLowerCase().repeat(64);
  }
}

class FakeUserRepository implements UserRepository {
  readonly users = new Map<string, User>();
  failure = false;

  async create(user: User): Promise<{ kind: "created" } | { kind: "duplicate-email" }> {
    if ([...this.users.values()].some(({ email }) => email === user.email)) return { kind: "duplicate-email" };
    this.users.set(user.id, user);
    return { kind: "created" };
  }

  async findByCanonicalEmail(email: string): Promise<User | null> {
    if (this.failure) throw new Error("database connection and SQL details");
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findById(userId: string): Promise<User | null> {
    if (this.failure) throw new Error("database connection and SQL details");
    return this.users.get(userId) ?? null;
  }
}

class FakeSessionRepository implements SessionRepository {
  readonly sessions = new Map<string, Session>();
  createFailure = false;

  async create(session: Session): Promise<void> {
    if (this.createFailure) throw new Error("session insert failed");
    this.sessions.set(session.tokenHash, session);
  }

  async findActiveByTokenHash(tokenHash: string, now: Date): Promise<Session | null> {
    const session = this.sessions.get(tokenHash);
    return session !== undefined && session.expiresAt > now ? session : null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }
}

class FakeRegistrationRepository implements AuthRegistrationRepository {
  readonly users = new Map<string, User>();
  readonly sessions = new Map<string, Session>();
  duplicate = false;
  sessionFailure = false;
  technicalFailure = false;

  async createUserWithSession(user: User, session: Session): Promise<{ kind: "created" } | { kind: "duplicate-email" }> {
    if (this.technicalFailure) throw new Error("constraint and SQL details");
    if (this.duplicate || [...this.users.values()].some(({ email }) => email === user.email)) {
      return { kind: "duplicate-email" };
    }

    // Stage both writes, then commit together, matching the port's transaction contract.
    const stagedUsers = new Map(this.users).set(user.id, user);
    if (this.sessionFailure) throw new Error("session insert failed");
    const stagedSessions = new Map(this.sessions).set(session.tokenHash, session);
    this.users.clear();
    stagedUsers.forEach((value, key) => this.users.set(key, value));
    this.sessions.clear();
    stagedSessions.forEach((value, key) => this.sessions.set(key, value));
    return { kind: "created" };
  }
}

function user(overrides: Partial<User> = {}): User {
  return {
    id: "b4d78321-e165-4434-b0df-bc73482733f2",
    email: "person@example.com",
    passwordHash: "fake-hash:correct password",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function expectCode(action: () => unknown | Promise<unknown>, code: string): Promise<void> | void {
  try {
    const result = action();
    if (result instanceof Promise) {
      return result.then(
        () => { throw new Error(`Expected ${code}`); },
        (error: unknown) => {
          expect(error).toBeInstanceOf(AuthApplicationError);
          expect((error as AuthApplicationError).code).toBe(code);
        },
      );
    }
  } catch (error) {
    expect(error).toBeInstanceOf(AuthApplicationError);
    expect((error as AuthApplicationError).code).toBe(code);
  }
}

describe("auth email normalization", () => {
  it("trims and locale-independently lowercases ASCII and Unicode", () => {
    expect(normalizeEmail("  ÜSER@EXAMPLE.COM  ")).toBe("üser@example.com");
  });

  it.each([
    ["missing at", "person.example.com"],
    ["multiple at", "a@b@example.com"],
    ["internal whitespace", "person @example.com"],
    ["control character", "person@exam\u0000ple.com"],
    ["empty local part", "@example.com"],
    ["empty domain", "person@"],
    ["over 254 code points", `${"a".repeat(243)}@example.com`],
    ["non-string", 42],
  ])("rejects %s", (_label, value) => expectCode(() => normalizeEmail(value), "INVALID_AUTH_REQUEST"));
});

describe("auth password validation", () => {
  it("enforces registration boundaries in Unicode code points", () => {
    expectCode(() => validateRegistrationPassword("a".repeat(11)), "INVALID_AUTH_REQUEST");
    expect(validateRegistrationPassword("a".repeat(12))).toHaveLength(12);
    expect(validateRegistrationPassword("a".repeat(128))).toHaveLength(128);
    expectCode(() => validateRegistrationPassword("a".repeat(129)), "INVALID_AUTH_REQUEST");
    expect(validateRegistrationPassword("😀".repeat(12))).toBe("😀".repeat(12));
  });

  it("preserves spaces and never trims password input", () => {
    const password = "  ten chars  ";
    expect(Array.from(password)).toHaveLength(13);
    expect(validateRegistrationPassword(password)).toBe(password);
  });

  it("lets login verify short and empty historical credentials but retains the maximum", () => {
    expect(validateLoginPassword("short")).toBe("short");
    expect(validateLoginPassword("")).toBe("");
    expect(validateLoginPassword("😀".repeat(128))).toBe("😀".repeat(128));
    expectCode(() => validateLoginPassword("😀".repeat(129)), "INVALID_AUTH_REQUEST");
    expectCode(() => validateLoginPassword(null), "INVALID_AUTH_REQUEST");
  });
});

describe("registerUser", () => {
  function setup() {
    const registrationRepository = new FakeRegistrationRepository();
    const passwordHasher = new FakePasswordHasher();
    const sessionTokenGenerator = new FakeTokenGenerator();
    const dependencies = { registrationRepository, passwordHasher, sessionTokenGenerator, clock: new FakeClock() };
    return { dependencies, registrationRepository, passwordHasher };
  }

  it("creates a canonical user, password hash, initial session, UUIDs, and public credential output", async () => {
    const { dependencies, registrationRepository, passwordHasher } = setup();
    const result = await registerUser(dependencies, { email: " Person@Example.COM ", password: "correct password" });
    const persistedUser = [...registrationRepository.users.values()][0]!;
    const persistedSession = [...registrationRepository.sessions.values()][0]!;

    expect(result.user).toEqual({ id: persistedUser.id, email: "person@example.com" });
    expect(result).not.toHaveProperty("passwordHash");
    expect(persistedUser.id).toMatch(UUID_V4);
    expect(persistedSession.id).toMatch(UUID_V4);
    expect(passwordHasher.hashed).toEqual(["correct password"]);
    expect(persistedUser.passwordHash).toBe("fake-hash:correct password");
    expect(JSON.stringify({ persistedUser, persistedSession })).not.toContain(`"password":"correct password"`);
    expect(persistedSession.userId).toBe(persistedUser.id);
    expect(persistedSession.tokenHash).toBe("a".repeat(64));
    expect(persistedSession).not.toHaveProperty("rawToken");
    expect(result.session.token).toBe(RAW_TOKEN);
    expect(result.session.expiresAt).toEqual(new Date("2026-10-09T12:00:00.000Z"));
  });

  it("maps duplicate canonical email explicitly and commits neither record", async () => {
    const { dependencies, registrationRepository } = setup();
    registrationRepository.duplicate = true;
    await expectCode(() => registerUser(dependencies, { email: "person@example.com", password: "correct password" }), "EMAIL_ALREADY_EXISTS");
    expect(registrationRepository.users).toHaveLength(0);
    expect(registrationRepository.sessions).toHaveLength(0);
  });

  it("leaves no user when session persistence fails inside the transaction", async () => {
    const { dependencies, registrationRepository } = setup();
    registrationRepository.sessionFailure = true;
    await expectCode(() => registerUser(dependencies, { email: "person@example.com", password: "correct password" }), "AUTH_INTERNAL_ERROR");
    expect(registrationRepository.users).toHaveLength(0);
    expect(registrationRepository.sessions).toHaveLength(0);
  });

  it("sanitizes technical adapter failures", async () => {
    const { dependencies, registrationRepository } = setup();
    registrationRepository.technicalFailure = true;
    try {
      await registerUser(dependencies, { email: "person@example.com", password: "correct password" });
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "AUTH_INTERNAL_ERROR", message: "The authentication operation failed." });
      expect(JSON.stringify(error)).not.toContain("SQL");
    }
  });
});

describe("loginUser", () => {
  function setup() {
    const userRepository = new FakeUserRepository();
    userRepository.users.set(user().id, user());
    const sessionRepository = new FakeSessionRepository();
    const passwordHasher = new FakePasswordHasher();
    const dependencies = {
      userRepository,
      sessionRepository,
      passwordHasher,
      sessionTokenGenerator: new FakeTokenGenerator(),
      clock: new FakeClock(),
    };
    return { dependencies, userRepository, sessionRepository, passwordHasher };
  }

  it("canonicalizes email, verifies the real hash, and creates a fresh independent session", async () => {
    const { dependencies, sessionRepository, passwordHasher } = setup();
    const first = await loginUser(dependencies, { email: " PERSON@EXAMPLE.COM ", password: "correct password" });
    const second = await loginUser(dependencies, { email: "person@example.com", password: "correct password" });
    expect(first.user).toEqual({ id: user().id, email: "person@example.com" });
    expect(passwordHasher.verified).toHaveLength(2);
    expect(passwordHasher.dummyVerified).toHaveLength(0);
    expect(first.session.id).not.toBe(second.session.id);
    expect(first.session.token).not.toBe(second.session.token);
    expect(sessionRepository.sessions).toHaveLength(2);
  });

  it("returns generic invalid credentials after a real verification failure", async () => {
    const { dependencies, passwordHasher } = setup();
    await expectCode(() => loginUser(dependencies, { email: "person@example.com", password: "wrong" }), "INVALID_CREDENTIALS");
    expect(passwordHasher.verified).toEqual([{ hash: "fake-hash:correct password", password: "wrong" }]);
  });

  it("returns the same error and calls dummy verification when the user is missing", async () => {
    const { dependencies, userRepository, passwordHasher } = setup();
    userRepository.users.clear();
    await expectCode(() => loginUser(dependencies, { email: "absent@example.com", password: "wrong" }), "INVALID_CREDENTIALS");
    expect(passwordHasher.dummyVerified).toEqual(["wrong"]);
    expect(passwordHasher.verified).toHaveLength(0);
  });

  it("sanitizes lookup and session persistence failures", async () => {
    const first = setup();
    first.userRepository.failure = true;
    await expectCode(() => loginUser(first.dependencies, { email: "person@example.com", password: "correct password" }), "AUTH_INTERNAL_ERROR");

    const second = setup();
    second.sessionRepository.createFailure = true;
    await expectCode(() => loginUser(second.dependencies, { email: "person@example.com", password: "correct password" }), "AUTH_INTERNAL_ERROR");
  });
});

describe("session authentication", () => {
  function setup(expiresAt = new Date("2026-09-10T12:00:00.000Z")) {
    const userRepository = new FakeUserRepository();
    userRepository.users.set(user().id, user());
    const sessionRepository = new FakeSessionRepository();
    sessionRepository.sessions.set(TOKEN_HASH, {
      id: "6227a806-660b-4544-82bf-3bea326a75fa",
      userId: user().id,
      tokenHash: TOKEN_HASH,
      expiresAt,
      createdAt: NOW,
    });
    const dependencies = { userRepository, sessionRepository, sessionTokenGenerator: new FakeTokenGenerator(), clock: new FakeClock() };
    return { dependencies, userRepository };
  }

  it("returns only public user data for an active session", async () => {
    const { dependencies } = setup();
    await expect(authenticateSession(dependencies, RAW_TOKEN)).resolves.toEqual({ id: user().id, email: user().email });
  });

  it("maps expired, malformed, and empty tokens to unauthenticated", async () => {
    await expectCode(() => authenticateSession(setup(new Date("2026-09-09T12:00:00.000Z")).dependencies, RAW_TOKEN), "UNAUTHENTICATED");
    await expectCode(() => authenticateSession(setup().dependencies, "malformed"), "UNAUTHENTICATED");
    await expectCode(() => authenticateSession(setup().dependencies, ""), "UNAUTHENTICATED");
  });

  it("maps a session whose user is missing to unauthenticated", async () => {
    const { dependencies, userRepository } = setup();
    userRepository.users.clear();
    await expectCode(() => authenticateSession(dependencies, RAW_TOKEN), "UNAUTHENTICATED");
  });
});

describe("logout", () => {
  it("deletes the current session and succeeds when repeated or malformed", async () => {
    const sessionRepository = new FakeSessionRepository();
    sessionRepository.sessions.set(TOKEN_HASH, {
      id: "6227a806-660b-4544-82bf-3bea326a75fa",
      userId: user().id,
      tokenHash: TOKEN_HASH,
      expiresAt: new Date("2026-09-10T12:00:00.000Z"),
      createdAt: NOW,
    });
    const dependencies = { sessionRepository, sessionTokenGenerator: new FakeTokenGenerator() };
    await logout(dependencies, RAW_TOKEN);
    expect(sessionRepository.sessions).toHaveLength(0);
    await expect(logout(dependencies, RAW_TOKEN)).resolves.toBeUndefined();
    await expect(logout(dependencies, "bad-token")).resolves.toBeUndefined();
  });
});
