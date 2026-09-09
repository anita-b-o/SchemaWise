import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi } from "./auth-api";
import { HttpApiError } from "./http-api";
import { projectApi } from "./project-api";

const authResponse = { user: { id: "123", email: "person@example.com" }, csrfToken: "csrf" };
const schema = { schemaVersion: 1 as const, relation: { name: "", attributes: [] }, functionalDependencies: [] };

afterEach(() => vi.unstubAllGlobals());

function response(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("authenticated HTTP clients", () => {
  it("uses credentialed requests without incoming CSRF for register, login, and me", async () => {
    const fetch = vi.fn().mockImplementation(async () => response(authResponse));
    vi.stubGlobal("fetch", fetch);
    await authApi.register("person@example.com", "password-long");
    await authApi.login("person@example.com", "password-long");
    await authApi.me();
    expect(fetch).toHaveBeenCalledTimes(3);
    for (const [, init] of fetch.mock.calls) expect(init.credentials).toBe("include");
    expect(fetch.mock.calls[0]![1].headers).not.toHaveProperty("X-CSRF-Token");
    expect(fetch.mock.calls[1]![1].headers).not.toHaveProperty("X-CSRF-Token");
  });

  it("sends in-memory CSRF on logout and every project mutation", async () => {
    const project = { id: "id", name: "Test", schema, revision: 1, createdAt: "now", updatedAt: "now" };
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(undefined, 204))
      .mockResolvedValueOnce(response({ project }, 201))
      .mockResolvedValueOnce(response({ project }))
      .mockResolvedValueOnce(response(undefined, 204));
    vi.stubGlobal("fetch", fetch);
    await authApi.logout("csrf");
    await projectApi.createProject({ name: "Test", schema }, "csrf");
    await projectApi.updateProject("id", { name: "Test", schema, expectedRevision: 1 }, "csrf");
    await projectApi.deleteProject("id", "csrf");
    for (const [, init] of fetch.mock.calls) {
      expect(init.credentials).toBe("include");
      expect(init.headers).toMatchObject({ "X-CSRF-Token": "csrf" });
    }
  });

  it("normalizes project error envelopes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: { code: "PROJECT_REVISION_CONFLICT", message: "conflict", details: { actualRevision: 2 } } }, 409)));
    await expect(projectApi.updateProject("id", { name: "Test", schema, expectedRevision: 1 }, "csrf")).rejects.toMatchObject({ kind: "api", status: 409, code: "PROJECT_REVISION_CONFLICT", details: { actualRevision: 2 } } satisfies Partial<HttpApiError>);
  });

  it("does not access browser storage", async () => {
    const local = vi.spyOn(Storage.prototype, "setItem");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(authResponse)));
    await authApi.login("person@example.com", "password-long");
    expect(local).not.toHaveBeenCalled();
    local.mockRestore();
  });
});
