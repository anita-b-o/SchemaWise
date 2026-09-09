import { describe, expect, it } from "vitest";
import {
  AUTH_SESSION_COOKIE_NAME,
  createAuthRuntime,
  createServer,
  DEFAULT_AUTH_RATE_LIMITS,
  deriveCsrfToken,
  readClientIpMode,
  readCsrfSecret,
  readAuthCookieConfig,
  resolveClientIp,
  type AuthRegistrationRepository,
  type Clock,
  type ClientIpMode,
  type PasswordHasher,
  type Session,
  type SessionTokenGenerator,
  type User,
  type UserRepository,
} from "../src/index.js";

const START = new Date("2026-09-09T12:00:00.000Z");
const PASSWORD = "correct password";
const CSRF_SECRET = "deterministic-test-csrf-secret-32-bytes";

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

function setup(secure = false, authRateLimits = DEFAULT_AUTH_RATE_LIMITS, clientIpMode: ClientIpMode = "direct") {
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
  const server = createServer({ auth, authCookie: { secure }, csrfSecret: CSRF_SECRET, authRateLimits, clientIpMode });
  return { server, store, clock };
}

function jsonPost(url: string, payload: unknown, cookie?: string, extraHeaders: Record<string, string> = {}) {
  return {
    method: "POST" as const,
    url,
    headers: { "content-type": "application/json", ...(cookie === undefined ? {} : { cookie }), ...extraHeaders },
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

  it("requires a strong CSRF secret and validates the client IP mode", () => {
    expect(readCsrfSecret({ CSRF_SECRET })).toBe(CSRF_SECRET);
    expect(() => readCsrfSecret({})).toThrow("CSRF_SECRET is required");
    expect(() => readCsrfSecret({ CSRF_SECRET: "too-short" })).toThrow("at least 32 bytes");
    expect(readClientIpMode({})).toBe("direct");
    expect(readClientIpMode({ CLIENT_IP_MODE: "direct" })).toBe("direct");
    expect(readClientIpMode({ CLIENT_IP_MODE: "render" })).toBe("render");
    expect(() => readClientIpMode({ CLIENT_IP_MODE: "proxy" })).toThrow("direct or render");
  });

  it("uses the socket IP in direct mode and ignores spoofed forwarding headers", async () => {
    const server = createServer();
    server.get("/client-ip", (request) => ({ ip: resolveClientIp(request, "direct") }));
    try {
      const response = await server.inject({
        method: "GET",
        url: "/client-ip",
        remoteAddress: "198.51.100.10",
        headers: { "x-forwarded-for": "203.0.113.99", "cf-connecting-ip": "203.0.113.98" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ip: "198.51.100.10" });
    } finally { await server.close(); }
  });

  it("uses only valid Render metadata and normalizes equivalent IPv6 identities", async () => {
    const server = createServer();
    server.get("/client-ip", (request) => ({ ip: resolveClientIp(request, "render") }));
    try {
      const first = await server.inject({
        method: "GET",
        url: "/client-ip",
        headers: { "cf-connecting-ip": "2001:db8:1234:5678::1", "x-forwarded-for": "203.0.113.99" },
      });
      const second = await server.inject({
        method: "GET",
        url: "/client-ip",
        headers: { "cf-connecting-ip": "2001:0db8:1234:5678:abcd::2", "x-forwarded-for": "192.0.2.8" },
      });
      expect(first.json()).toEqual({ ip: "2001:db8:1234:5678::" });
      expect(second.json()).toEqual(first.json());

      for (const value of [undefined, "not-an-ip", "198.51.100.2, 203.0.113.4", " 198.51.100.2 "]) {
        const response = await server.inject({
          method: "GET",
          url: "/client-ip",
          headers: value === undefined ? {} : { "cf-connecting-ip": value },
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe("INVALID_CLIENT_IP");
      }
    } finally { await server.close(); }
  });

  it("registers, canonicalizes the public user, and sets the host-only session cookie", async () => {
    const { server } = setup();
    try {
      const response = await server.inject(jsonPost("/api/v1/auth/register", { email: " Person@Example.COM ", password: PASSWORD }));
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ user: { email: "person@example.com" } });
      expect(response.json().csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
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
      const logout = await server.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie: cookiePair(response), "x-csrf-token": response.json().csrfToken } });
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
      expect(loggedIn.json().user).toEqual(registered.json().user);
      expect(loggedIn.json().csrfToken).not.toBe(registered.json().csrfToken);
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
      const csrf1 = registered.json().csrfToken;
      expect((await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie1 } })).statusCode).toBe(200);
      expect((await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie2 } })).statusCode).toBe(200);
      expect(store.sessions).toHaveLength(2);

      const logout = await server.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie: cookie1, "x-csrf-token": csrf1 } });
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
      csrfSecret: CSRF_SECRET,
    });
    try {
      const response = await failing.inject(jsonPost("/api/v1/auth/register", { email: "person@example.com", password: PASSWORD }));
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: { code: "AUTH_INTERNAL_ERROR", message: "The authentication operation failed." } });
      expect(response.body).not.toContain("SQL");
      expect(response.body).not.toContain(PASSWORD);
    } finally { await failing.close(); }
  });

  it("binds CSRF to one session and enforces it only for a valid-session logout", async () => {
    const { server } = setup();
    try {
      const registered = await server.inject(jsonPost("/api/v1/auth/register", { email: "person@example.com", password: PASSWORD }));
      const loggedIn = await server.inject(jsonPost("/api/v1/auth/login", { email: "person@example.com", password: PASSWORD }));
      const cookie1 = cookiePair(registered);
      const cookie2 = cookiePair(loggedIn);
      const csrf1 = registered.json().csrfToken as string;
      const csrf2 = loggedIn.json().csrfToken as string;

      expect(csrf1).not.toBe(csrf2);
      expect((await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie1 } })).json().csrfToken).toBe(csrf1);

      for (const token of [undefined, "wrong", csrf2]) {
        const response = await server.inject({
          method: "POST",
          url: "/api/v1/auth/logout",
          headers: { cookie: cookie1, ...(token === undefined ? {} : { "x-csrf-token": token }) },
        });
        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual({ error: { code: "INVALID_CSRF_TOKEN", message: "The CSRF validation failed." } });
      }

      expect((await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie1 } })).statusCode).toBe(200);
      expect((await server.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie: cookie1, "x-csrf-token": csrf1 } })).statusCode).toBe(204);
      expect((await server.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: cookie2 } })).statusCode).toBe(200);
      expect((await server.inject({ method: "POST", url: "/api/v1/auth/logout" })).statusCode).toBe(204);
      expect((await server.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie: `${AUTH_SESSION_COOKIE_NAME}=bad` } })).statusCode).toBe(204);
    } finally { await server.close(); }
  });

  it("validates Origin exactly, falls back to parsed Referer, and permits headerless direct clients", async () => {
    const { server } = setup();
    try {
      const allowed = await server.inject(jsonPost("/api/v1/auth/register", { email: "one@example.com", password: PASSWORD }, undefined, { origin: "http://localhost:5173" }));
      expect(allowed.statusCode).toBe(201);

      const referer = await server.inject(jsonPost("/api/v1/auth/register", { email: "two@example.com", password: PASSWORD }, undefined, { referer: "http://localhost:5173/signup?from=test" }));
      expect(referer.statusCode).toBe(201);

      const allowedLogin = await server.inject(jsonPost("/api/v1/auth/login", { email: "one@example.com", password: PASSWORD }, undefined, { origin: "http://localhost:5173" }));
      expect(allowedLogin.statusCode).toBe(200);

      for (const headers of [
        { origin: "http://evil-localhost:5173" },
        { referer: "not a url" },
        { origin: "https://evil.example", referer: "http://localhost:5173/signup" },
      ]) {
        const rejected = await server.inject(jsonPost("/api/v1/auth/login", { email: "one@example.com", password: PASSWORD }, undefined, headers));
        expect(rejected.statusCode).toBe(403);
        expect(rejected.json().error.code).toBe("INVALID_CSRF_TOKEN");
      }

      const direct = await server.inject(jsonPost("/api/v1/auth/login", { email: "two@example.com", password: PASSWORD }));
      expect(direct.statusCode).toBe(200);
    } finally { await server.close(); }
  });

  it("derives deterministic session-bound CSRF values without exposing session identity", () => {
    const first = deriveCsrfToken(CSRF_SECRET, "session-a");
    expect(first).toBe(deriveCsrfToken(CSRF_SECRET, "session-a"));
    expect(first).not.toBe(deriveCsrfToken(CSRF_SECRET, "session-b"));
    expect(first).not.toContain("session-a");
  });

  it("limits login by IP with a generic 429 and Retry-After", async () => {
    const { server } = setup(false, { ...DEFAULT_AUTH_RATE_LIMITS, loginIpMax: 2, loginEmailIpMax: 20 });
    try {
      for (const email of ["one@example.com", "two@example.com"]) {
        expect((await server.inject(jsonPost("/api/v1/auth/login", { email, password: "wrong" }))).statusCode).toBe(401);
      }
      const limited = await server.inject(jsonPost("/api/v1/auth/login", { email: "three@example.com", password: "wrong" }));
      expect(limited.statusCode).toBe(429);
      expect(limited.json()).toEqual({ error: { code: "AUTH_RATE_LIMITED", message: "Too many authentication attempts. Try again later." } });
      expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
      expect(limited.headers["x-ratelimit-limit"]).toBeUndefined();
      expect(limited.body).not.toContain("auth-login");
      expect(limited.body).not.toContain("three@example.com");
    } finally { await server.close(); }
  });

  it("shares the login email+IP bucket across canonical email spelling", async () => {
    const { server } = setup(false, { ...DEFAULT_AUTH_RATE_LIMITS, loginIpMax: 20, loginEmailIpMax: 2 });
    try {
      for (const email of [" Person@Example.com ", "PERSON@example.COM"]) {
        expect((await server.inject(jsonPost("/api/v1/auth/login", { email, password: "wrong" }))).statusCode).toBe(401);
      }
      const limited = await server.inject(jsonPost("/api/v1/auth/login", { email: "person@example.com", password: "wrong" }));
      expect(limited.statusCode).toBe(429);
      expect(limited.json().error.code).toBe("AUTH_RATE_LIMITED");
      expect(limited.headers["retry-after"]).toBeDefined();
    } finally { await server.close(); }
  });

  it("limits registration by IP without applying a global API limit", async () => {
    const { server } = setup(false, { ...DEFAULT_AUTH_RATE_LIMITS, registerIpMax: 2 });
    try {
      for (const email of ["one@example.com", "two@example.com"]) {
        expect((await server.inject(jsonPost("/api/v1/auth/register", { email, password: PASSWORD }))).statusCode).toBe(201);
      }
      const limited = await server.inject(jsonPost("/api/v1/auth/register", { email: "three@example.com", password: PASSWORD }));
      expect(limited.statusCode).toBe(429);
      expect(limited.json().error.code).toBe("AUTH_RATE_LIMITED");
      expect(limited.headers["retry-after"]).toBeDefined();
      const computation = await server.inject({ method: "POST", url: "/api/v1/analysis", headers: { "content-type": "application/json" }, payload: "{}" });
      expect(computation.statusCode).not.toBe(429);
    } finally { await server.close(); }
  });

  it("keys Render rate limits consistently by trusted metadata, not X-Forwarded-For", async () => {
    const { server } = setup(false, { ...DEFAULT_AUTH_RATE_LIMITS, loginIpMax: 2, loginEmailIpMax: 20 }, "render");
    try {
      for (const spoofed of ["203.0.113.1", "203.0.113.2"]) {
        const response = await server.inject({
          ...jsonPost("/api/v1/auth/login", { email: `${spoofed}@example.com`, password: "wrong" }, undefined, {
            "cf-connecting-ip": "198.51.100.10",
            "x-forwarded-for": spoofed,
          }),
        });
        expect(response.statusCode).toBe(401);
      }
      const limited = await server.inject(jsonPost("/api/v1/auth/login", { email: "third@example.com", password: "wrong" }, undefined, {
        "cf-connecting-ip": "198.51.100.10",
        "x-forwarded-for": "192.0.2.50",
      }));
      expect(limited.statusCode).toBe(429);
      expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    } finally { await server.close(); }
  });

  it("keeps distinct Render clients in distinct rate-limit buckets", async () => {
    const { server } = setup(false, { ...DEFAULT_AUTH_RATE_LIMITS, loginIpMax: 1, loginEmailIpMax: 20 }, "render");
    try {
      for (const ip of ["198.51.100.10", "198.51.100.11"]) {
        const response = await server.inject(jsonPost("/api/v1/auth/login", { email: `${ip}@example.com`, password: "wrong" }, undefined, {
          "cf-connecting-ip": ip,
        }));
        expect(response.statusCode).toBe(401);
      }
      const limited = await server.inject(jsonPost("/api/v1/auth/login", { email: "again@example.com", password: "wrong" }, undefined, {
        "cf-connecting-ip": "198.51.100.10",
      }));
      expect(limited.statusCode).toBe(429);
    } finally { await server.close(); }
  });
});
