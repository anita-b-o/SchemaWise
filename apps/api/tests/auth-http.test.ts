import { describe, expect, it } from "vitest";
import {
  AUTH_SESSION_COOKIE_NAME,
  createAuthRuntime,
  createServer,
  readAuthCookieConfig,
  type AuthRegistrationRepository,
  type Clock,
  type PasswordHasher,
  type Session,
  type SessionTokenGenerator,
  type User,
  type UserRepository,
} from "../src/index.js";

const START = new Date("2026-09-09T12:00:00.000Z");
const PASSWORD = "correct password";

class MutableClock implements Clock {
  value = new Date(START);
  now(): Date { return new Date(this.value); }
}

class MemoryStore implements UserRepository, SessionRepository, AuthRegistrationRepository {
  readonly users = new Map<string, User>();
  readonly sessions = new Map<string, Session>();

  async create(user: User): Promise<{ kind: "created" } | { kind: "duplicate-email" }> {
    if ([...this.users.values()].some((candidate) => candidate.email === user.email)) return { kind: "duplicate-email" };
    this.users.set(user.id, user);
    return { kind: "created" };
  }

  async findByCanonicalEmail(email: string): Promise<User | null> {
    return [...this.users.values()].find((candidate) => candidate.email === email) ?? null;
  }

  async findById(userId: string): Promise<User | null> {
    return this.users.get(userId) ?? null;
  }

  async createUserWithSession(user: User, session: Session): Promise<{ kind: "created" } | { kind: "duplicate-email" }> {
    const result = await this.create(user);
    if (result.kind === "duplicate-email") return result;
    this.sessions.set(session.tokenHash, session);
    return { kind: "created" };
  }

  async createSession(session: Session): Promise<void> {
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

class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> { return `hash:${password}`; }
  async verify(hash: string, password: string): Promise<boolean> { return hash === `hash:${password}`; }
  async dummyVerify(_password: string): Promise<void> {}
}

class SequencedTokenGenerator implements SessionTokenGenerator {
  sequence = 0;
  async generate(): Promise<{ rawToken: string; tokenHash: string }> {
    const character = String.fromCharCode(65 + this.sequence++);
    return { rawToken: character.repeat(43), tokenHash: character.toLowerCase().repeat(64) };
  }
  async hash(rawToken: string): Promise<string> { return rawToken[0]!.toLowerCase().repeat(64); }
}

function setup(secure = false) {
  const store = new MemoryStore();
  const clock = new MutableClock();
  const tokenGenerator = new SequencedTokenGenerator();
  const auth = createAuthRuntime({
    registrationRepository: store,
    userRepository: store,
    sessionRepository: {
      create: (session) => store.createSession(session),
      findActiveByTokenHash: (hash, now) => store.findActiveByTokenHash(hash, now),
      deleteByTokenHash: (hash) => store.deleteByTokenHash(hash),
    },
    passwordHasher: new FakePasswordHasher(),
    sessionTokenGenerator: tokenGenerator,
    clock,
  });
  const server = createServer({ auth, authCookie: { secure } });
  return { server, store, clock };
}

function jsonPost(url: string, payload: unknown, cookie?: string) {
  return {
    method: "POST" as const,
    url,
    headers: { "content-type": "application/json", ...(cookie === undefined ? {} : { cookie }) },
    payload: JSON.stringify(payload),
  };
}

function cookiePair(response: { headers: Record<string, string | string[] | undefined> }): string {
  const header = response.headers["set-cookie"];
  const value = Array.isArray(header) ? header[0] : header;
  if (value === undefined) throw new Error("Expected Set-Cookie");
  return value.split(";", 1)[0]!;
}

describe("authentication HTTP v1", () => {
  it("requires an explicit boolean cookie security environment value", () => {
    expect(readAuthCookieConfig({ AUTH_COOKIE_SECURE: "false" })).toEqual({ secure: false });
    expect(readAuthCookieConfig({ AUTH_COOKIE_SECURE: "true" })).toEqual({ secure: true });
    expect(() => readAuthCookieConfig({})).toThrow("AUTH_COOKIE_SECURE is required");
    expect(() => readAuthCookieConfig({ AUTH_COOKIE_SECURE: "1" })).toThrow("AUTH_COOKIE_SECURE is required");
  });

  it("registers, canonicalizes the public user, and sets the host-only session cookie", async () => {
    const { server } = setup();
    try {
      const response = await server.inject(jsonPost("/api/v1/auth/register", { email: " Person@Example.COM ", password: PASSWORD }));
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ user: { email: "person@example.com" } });
      expect(response.json().user.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.body).not.toContain("token");
      expect(response.body).not.toContain(PASSWORD);
      const setCookie = response.headers["set-cookie"] as string;
      expect(setCookie).toContain(`${AUTH_SESSION_COOKIE_NAME}=${"A".repeat(43)}`);
      expect(setCookie).toContain("Max-Age=2592000");
      expect(setCookie).toContain("Path=/");
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Lax");
      expect(setCookie).toContain("Expires=");
      expect(setCookie).not.toContain("Secure");
      expect(setCookie).not.toContain("Domain=");
    } finally { await server.close(); }
  });

  it("honors secure cookie configuration when setting and clearing", async () => {
    const { server } = setup(true);
    try {
      const response = await server.inject(jsonPost("/api/v1/auth/register", { email: "person@example.com", password: PASSWORD }));
      expect(response.headers["set-cookie"]).toContain("Secure");
      const logout = await server.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie: cookiePair(response) } });
      expect(logout.headers["set-cookie"]).toContain("Secure");
    } finally { await server.close(); }
  });

  it("maps duplicate email and invalid register DTOs without leaking credentials", async () => {
    const { server } = setup();
    try {
      await server.inject(jsonPost("/api/v1/auth/register", { email: "person@example.com", password: PASSWORD }));
      const duplicate = await server.inject(jsonPost("/api/v1/auth/register", { email: "PERSON@example.com", password: PASSWORD }));
      expect(duplicate.statusCode).toBe(409);
      expect(duplicate.json().error.code).toBe("EMAIL_ALREADY_EXISTS");

      for (const body of [
        { email: "invalid", password: PASSWORD },
        { email: "other@example.com", password: "short" },
        { email: "other@example.com", password: PASSWORD, unexpected: true },
      ]) {
        const invalid = await server.inject(jsonPost("/api/v1/auth/register", body));
        expect(invalid.statusCode).toBe(400);
        expect(invalid.json().error.code).toBe("INVALID_AUTH_REQUEST");
        expect(invalid.body).not.toContain(PASSWORD);
      }
    } finally { await server.close(); }
  });

  it("logs in with a fresh cookie and makes wrong-password and unknown-email responses identical", async () => {
    const { server } = setup();
    try {
      const registered = await server.inject(jsonPost("/api/v1/auth/register", { email: "person@example.com", password: PASSWORD }));
      const loggedIn = await server.inject(jsonPost("/api/v1/auth/login", { email: "person@example.com", password: PASSWORD }));
      expect(loggedIn.statusCode).toBe(200);
      expect(loggedIn.json()).toEqual(registered.json());
      expect(cookiePair(loggedIn)).not.toBe(cookiePair(registered));

      const wrong = await server.inject(jsonPost("/api/v1/auth/login", { email: "person@example.com", password: "wrong password" }));
      const unknown = await server.inject(jsonPost("/api/v1/auth/login", { email: "unknown@example.com", password: "wrong password" }));
      expect(wrong.statusCode).toBe(401);
      expect(unknown.statusCode).toBe(401);
      expect(wrong.json()).toEqual(unknown.json());
      expect(wrong.json()).toEqual({ error: { code: "INVALID_CREDENTIALS", message: "The email or password is incorrect." } });
    } finally { await server.close(); }
  });

  it("resolves valid sessions and rejects missing, malformed, revoked, and expired cookies", async () => {
    const { server, store, clock } = setup();
    try {
      const registered = await server.inject(jsonPost("/api/v1/auth/register", { email: "person@example.com", password: PASSWORD }));
      const validCookie = cookiePair(registered);
      const me = await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: validCookie } });
      expect(me.statusCode).toBe(200);
      expect(me.json()).toEqual(registered.json());

      const missing = await server.inject({ method: "GET", url: "/api/v1/auth/me" });
      expect(missing.statusCode).toBe(401);
      expect(missing.json().error.code).toBe("UNAUTHENTICATED");
      expect(missing.headers["set-cookie"]).toBeUndefined();

      const malformed = await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: `${AUTH_SESSION_COOKIE_NAME}=bad` } });
      expect(malformed.statusCode).toBe(401);
      expect(malformed.headers["set-cookie"]).toContain(`${AUTH_SESSION_COOKIE_NAME}=;`);
      expect(malformed.headers["set-cookie"]).toContain("Path=/");

      store.sessions.clear();
      const revoked = await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: validCookie } });
      expect(revoked.statusCode).toBe(401);

      const second = await server.inject(jsonPost("/api/v1/auth/login", { email: "person@example.com", password: PASSWORD }));
      clock.value = new Date("2026-10-10T12:00:00.000Z");
      const expired = await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookiePair(second) } });
      expect(expired.statusCode).toBe(401);
      expect(expired.headers["set-cookie"]).toContain(`${AUTH_SESSION_COOKIE_NAME}=;`);
    } finally { await server.close(); }
  });

  it("logs out idempotently, revokes only the presented session, and clears the matching cookie path", async () => {
    const { server, store } = setup();
    try {
      const registered = await server.inject(jsonPost("/api/v1/auth/register", { email: "person@example.com", password: PASSWORD }));
      const loggedIn = await server.inject(jsonPost("/api/v1/auth/login", { email: "person@example.com", password: PASSWORD }));
      const cookie1 = cookiePair(registered);
      const cookie2 = cookiePair(loggedIn);
      expect((await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie1 } })).statusCode).toBe(200);
      expect((await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie2 } })).statusCode).toBe(200);
      expect(store.sessions).toHaveLength(2);

      const logout = await server.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie: cookie1 } });
      expect(logout.statusCode).toBe(204);
      expect(logout.body).toBe("");
      expect(logout.headers["set-cookie"]).toContain(`${AUTH_SESSION_COOKIE_NAME}=;`);
      expect(logout.headers["set-cookie"]).toContain("Path=/");
      expect(logout.headers["set-cookie"]).toContain("HttpOnly");
      expect(logout.headers["set-cookie"]).toContain("SameSite=Lax");
      expect(logout.headers["set-cookie"]).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
      expect(logout.headers["set-cookie"]).not.toContain("Domain=");
      expect(store.sessions).toHaveLength(1);
      expect((await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie1 } })).statusCode).toBe(401);
      expect((await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie2 } })).statusCode).toBe(200);
      expect((await server.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie: cookie1 } })).statusCode).toBe(204);
      expect((await server.inject({ method: "POST", url: "/api/v1/auth/logout" })).statusCode).toBe(204);
    } finally { await server.close(); }
  });

  it("maps malformed JSON and unexpected auth failures to sanitized auth envelopes", async () => {
    const { server } = setup();
    try {
      const malformed = await server.inject({ method: "POST", url: "/api/v1/auth/login", headers: { "content-type": "application/json" }, payload: "{" });
      expect(malformed.statusCode).toBe(400);
      expect(malformed.json().error.code).toBe("INVALID_AUTH_REQUEST");
    } finally { await server.close(); }

    const failing = createServer({
      auth: {
        register: async () => { throw new Error("SQL password cookie raw-token secret"); },
        login: async () => { throw new Error("unused"); },
        authenticate: async () => { throw new Error("unused"); },
        logout: async () => { throw new Error("unused"); },
      },
      authCookie: { secure: false },
    });
    try {
      const response = await failing.inject(jsonPost("/api/v1/auth/register", { email: "person@example.com", password: PASSWORD }));
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: { code: "AUTH_INTERNAL_ERROR", message: "The authentication operation failed." } });
      expect(response.body).not.toContain("SQL");
      expect(response.body).not.toContain(PASSWORD);
    } finally { await failing.close(); }
  });
});
