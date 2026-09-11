import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createProxyAssertion } from "@schemawise/proxy-assertion";
import {
  authError,
  createServer,
  DEFAULT_AUTH_RATE_LIMITS,
  type AuthRuntime,
  type ProjectRepository,
} from "../src/index.js";

const SECRET = "proxy-http-security-test-secret-32-bytes";
const CSRF_SECRET = "proxy-http-csrf-test-secret-32-bytes";
const WEB_ORIGIN = "https://schemawise-staging.vercel.app";
const PASSWORD = "correct password";

function proxyHeaders(method: string, pathAndQuery: string, clientIp = "198.51.100.10") {
  const assertion = createProxyAssertion({ method, pathAndQuery, clientIp, secret: SECRET });
  return {
    "x-schemawise-proxy-ip": assertion.clientIp,
    "x-schemawise-proxy-timestamp": assertion.timestamp,
    "x-schemawise-proxy-signature": assertion.signature,
  };
}

function fakeAuth(): AuthRuntime {
  let sequence = 0;
  return {
    register: async (input) => {
      sequence += 1;
      return {
        user: { id: randomUUID(), email: String(input.email).trim().toLowerCase() },
        session: { id: randomUUID(), token: String.fromCharCode(64 + sequence).repeat(43), expiresAt: new Date(Date.now() + 60_000) },
      };
    },
    login: async () => { throw authError("INVALID_CREDENTIALS", "The email or password is incorrect."); },
    authenticate: async () => { throw authError("UNAUTHENTICATED", "Authentication is required."); },
    logout: async () => undefined,
  };
}

function fakeProjects(): ProjectRepository {
  return {
    create: vi.fn(async () => { throw new Error("must not run"); }),
    findById: vi.fn(async () => null),
    list: vi.fn(async () => ({ projects: [], total: 0 })),
    update: vi.fn(async () => ({ kind: "not-found" as const })),
    delete: vi.fn(async () => ({ kind: "not-found" as const })),
  };
}

function server(limits = DEFAULT_AUTH_RATE_LIMITS, auth = fakeAuth(), projectRepository = fakeProjects()) {
  return createServer({
    auth,
    projectRepository,
    authCookie: { secure: false },
    csrfSecret: CSRF_SECRET,
    corsOrigins: [WEB_ORIGIN],
    clientIpMode: "vercel-proxy",
    stagingProxySecret: SECRET,
    authRateLimits: limits,
    readinessCheck: { query: async () => ({ rows: [{ ok: 1 }] }) },
    useCases: {
      analyzeSchema: () => ({ direct: true }),
      calculateClosure: () => ({}),
      synthesizeThirdNormalForm: () => ({}),
      decomposeBoyceCodd: () => ({}),
      analyzeDependencyPreservation: () => ({}),
    },
  });
}

function authPost(path: string, email: string, clientIp?: string, extra: Record<string, string> = {}) {
  return {
    method: "POST" as const,
    url: path,
    headers: {
      "content-type": "application/json",
      ...proxyHeaders("POST", path, clientIp),
      ...extra,
    },
    payload: JSON.stringify({ email, password: PASSWORD }),
  };
}

describe("vercel-proxy API policy", () => {
  it("fails startup without a strong shared secret only in vercel-proxy mode", () => {
    expect(() => createServer({ clientIpMode: "vercel-proxy", stagingProxySecret: "short" })).toThrow("STAGING_PROXY_SECRET");
    expect(() => createServer({ clientIpMode: "direct" })).not.toThrow();
  });

  it("rejects direct Auth and Project calls before authentication or repository work", async () => {
    const auth = fakeAuth();
    const projectRepository = fakeProjects();
    const register = vi.spyOn(auth, "register");
    const login = vi.spyOn(auth, "login");
    const authenticate = vi.spyOn(auth, "authenticate");
    const app = server(DEFAULT_AUTH_RATE_LIMITS, auth, projectRepository);
    try {
      for (const request of [
        { method: "POST", url: "/api/v1/auth/register", headers: { "content-type": "application/json" }, payload: "{}" },
        { method: "POST", url: "/api/v1/auth/login", headers: { "content-type": "application/json" }, payload: "{}" },
        { method: "GET", url: "/api/v1/auth/me" },
        { method: "GET", url: "/api/v1/projects" },
        { method: "POST", url: "/api/v1/projects", headers: { "content-type": "application/json" }, payload: "{}" },
      ] as const) {
        const response = await app.inject(request);
        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual({ error: { code: "INVALID_PROXY_ASSERTION", message: "Request proxy identity could not be verified." } });
      }
      expect(register).not.toHaveBeenCalled();
      expect(login).not.toHaveBeenCalled();
      expect(authenticate).not.toHaveBeenCalled();
      expect(projectRepository.create).not.toHaveBeenCalled();
      expect(projectRepository.list).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it("lets register and login reach their use cases with valid proxy provenance and no incoming CSRF token", async () => {
    const base = fakeAuth();
    const auth: AuthRuntime = {
      ...base,
      login: async (input) => ({
        user: { id: randomUUID(), email: String(input.email).trim().toLowerCase() },
        session: { id: randomUUID(), token: "L".repeat(43), expiresAt: new Date(Date.now() + 60_000) },
      }),
    };
    const register = vi.spyOn(auth, "register");
    const login = vi.spyOn(auth, "login");
    const app = server(DEFAULT_AUTH_RATE_LIMITS, auth);
    try {
      const registerResponse = await app.inject(authPost(
        "/api/v1/auth/register",
        "register@example.com",
        undefined,
        { origin: WEB_ORIGIN },
      ));
      const loginResponse = await app.inject(authPost(
        "/api/v1/auth/login",
        "login@example.com",
        undefined,
        { origin: WEB_ORIGIN },
      ));

      expect(registerResponse.statusCode).toBe(201);
      expect(loginResponse.statusCode).toBe(200);
      expect(registerResponse.json().csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(loginResponse.json().csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(register).toHaveBeenCalledOnce();
      expect(login).toHaveBeenCalledOnce();
    } finally { await app.close(); }
  });

  it("rejects disallowed register and login origins before their use cases", async () => {
    const auth = fakeAuth();
    const register = vi.spyOn(auth, "register");
    const login = vi.spyOn(auth, "login");
    const app = server(DEFAULT_AUTH_RATE_LIMITS, auth);
    try {
      for (const path of ["/api/v1/auth/register", "/api/v1/auth/login"] as const) {
        const response = await app.inject(authPost(path, "person@example.com", undefined, { origin: "https://evil.example" }));
        expect(response.statusCode).toBe(403);
      }
      expect(register).not.toHaveBeenCalled();
      expect(login).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it("keeps computational and operational routes directly accessible", async () => {
    const app = server();
    try {
      const analysis = await app.inject({ method: "POST", url: "/api/v1/analysis", headers: { "content-type": "application/json" }, payload: "{}" });
      expect(analysis.statusCode).toBe(200);
      expect(analysis.json()).toEqual({ direct: true });
      expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
      expect((await app.inject({ method: "GET", url: "/ready" })).statusCode).toBe(200);
    } finally { await app.close(); }
  });

  it("uses the verified assertion for IP buckets and ignores spoofed X-Forwarded-For", async () => {
    const auth = fakeAuth();
    const login = vi.spyOn(auth, "login");
    const app = server({ ...DEFAULT_AUTH_RATE_LIMITS, loginIpMax: 1, loginEmailIpMax: 20 }, auth);
    try {
      const first = await app.inject(authPost("/api/v1/auth/login", "one@example.com", "198.51.100.10", { "x-forwarded-for": "203.0.113.1" }));
      const secondClient = await app.inject(authPost("/api/v1/auth/login", "two@example.com", "198.51.100.11", { "x-forwarded-for": "198.51.100.10" }));
      const limited = await app.inject(authPost("/api/v1/auth/login", "three@example.com", "198.51.100.10", { "x-forwarded-for": "203.0.113.2" }));
      expect(first.statusCode).toBe(401);
      expect(secondClient.statusCode).toBe(401);
      expect(limited.statusCode).toBe(429);
      expect(login).toHaveBeenCalledTimes(2);
    } finally { await app.close(); }
  });

  it("preserves IPv6 /64 and canonical email+IP limit keys", async () => {
    const app = server({ ...DEFAULT_AUTH_RATE_LIMITS, loginIpMax: 20, loginEmailIpMax: 1 });
    try {
      const first = await app.inject(authPost("/api/v1/auth/login", " Person@Example.com ", "2001:db8:1234:5678::1"));
      const limited = await app.inject(authPost("/api/v1/auth/login", "PERSON@example.COM", "2001:db8:1234:5678:abcd::2"));
      expect(first.statusCode).toBe(401);
      expect(limited.statusCode).toBe(429);
    } finally { await app.close(); }
  });

  it("uses verified registration IP buckets and rejects bad assertions without selecting a bucket", async () => {
    const app = server({ ...DEFAULT_AUTH_RATE_LIMITS, registerIpMax: 1 });
    try {
      const bad = authPost("/api/v1/auth/register", "bad@example.com", "198.51.100.9");
      bad.headers["x-schemawise-proxy-signature"] = "A".repeat(43);
      expect((await app.inject(bad)).statusCode).toBe(403);
      expect((await app.inject(authPost("/api/v1/auth/register", "one@example.com", "198.51.100.9"))).statusCode).toBe(201);
      expect((await app.inject(authPost("/api/v1/auth/register", "two@example.com", "198.51.100.10"))).statusCode).toBe(201);
      expect((await app.inject(authPost("/api/v1/auth/register", "three@example.com", "198.51.100.9"))).statusCode).toBe(429);
    } finally { await app.close(); }
  });
});
