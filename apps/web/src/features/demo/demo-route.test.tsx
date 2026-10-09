import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import type { AuthApi } from "../../api/auth-api";
import { HttpApiError } from "../../api/http-api";
import type { ProjectApi } from "../../api/project-api";
import type { SchemaWiseApi } from "../../api/schemawise-api";
import { workspaceResourceIdentity } from "../projects/workspace-resource-identity";

function clients() {
  const authApi: AuthApi = { me: vi.fn(async () => { throw new HttpApiError({ kind: "api", status: 401, code: "UNAUTHORIZED", message: "No session" }); }), login: vi.fn(), register: vi.fn(), logout: vi.fn() };
  const projectsApi: ProjectApi = { getProject: vi.fn(), listProjects: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(), deleteProject: vi.fn() };
  const api: SchemaWiseApi = { analyzeSchema: vi.fn(), calculateClosure: vi.fn(), synthesizeThirdNormalForm: vi.fn(), decomposeBoyceCodd: vi.fn(), analyzeDependencyPreservation: vi.fn() };
  return { authApi, projectsApi, api };
}

function mount(path = "/demo") {
  window.history.replaceState(null, "", path);
  const clientsForRoute = clients();
  const user = userEvent.setup();
  const rendered = render(<StrictMode><App {...clientsForRoute} /></StrictMode>);
  return { ...clientsForRoute, user, ...rendered };
}

afterEach(() => { window.history.replaceState(null, "", "/"); vi.restoreAllMocks(); });

describe("isolated demo route", () => {
  it("keeps a distinct identity and mounts no Auth or Project capabilities in StrictMode", async () => {
    const { authApi, projectsApi, api } = mount();
    expect(workspaceResourceIdentity("/demo")).toBe("DEMO WORKSPACE");
    expect(workspaceResourceIdentity("/demo")).not.toBe(workspaceResourceIdentity("/"));
    expect(workspaceResourceIdentity("/projects/11111111-1111-4111-8111-111111111111")).not.toBe("DEMO WORKSPACE");
    expect(screen.getByRole("heading", { name: "Define a relation and its dependencies." })).toBeTruthy();
    expect(screen.getByText(/Your work is temporary/)).toBeTruthy();
    expect(screen.getByText(/Pampa Software/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Load example" })).toBeNull();
    expect(authApi.me).not.toHaveBeenCalled();
    for (const operation of Object.values(projectsApi)) expect(operation).not.toHaveBeenCalled();
    for (const operation of Object.values(api)) expect(operation).not.toHaveBeenCalled();
  });

  it.each(["/demo?view=analysis", "/demo?view=transform", "/demo?view=unknown"])("opens %s without computing or session recovery", (path) => {
    const { authApi, projectsApi, api } = mount(path);
    const expected = path.endsWith("analysis") ? "Analysis" : path.endsWith("transform") ? "Transformations" : "Define a relation and its dependencies.";
    expect(screen.getByRole("heading", { name: expected, level: 1 })).toBeTruthy();
    expect(authApi.me).not.toHaveBeenCalled();
    for (const operation of Object.values(projectsApi)) expect(operation).not.toHaveBeenCalled();
    for (const operation of Object.values(api)) expect(operation).not.toHaveBeenCalled();
  });

  it("keeps an unknown Demo path out of Auth and Projects", () => {
    const { authApi, projectsApi, api } = mount("/demo/unknown");
    expect(screen.getByRole("heading", { name: "Page not found." })).toBeTruthy();
    expect(authApi.me).not.toHaveBeenCalled();
    for (const operation of Object.values(projectsApi)) expect(operation).not.toHaveBeenCalled();
    for (const operation of Object.values(api)) expect(operation).not.toHaveBeenCalled();
  });

  it("preserves the draft through view history without requests", async () => {
    const { user, api, authApi, projectsApi } = mount();
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), "Local");
    await user.click(screen.getByRole("link", { name: "Analysis" }));
    expect(screen.getByRole("heading", { name: "Analysis", level: 1 })).toBeTruthy();
    await user.click(screen.getByRole("link", { name: "Transform" }));
    expect(screen.getByRole("heading", { name: "Transformations", level: 1 })).toBeTruthy();
    await act(async () => { window.history.back(); });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Analysis", level: 1 })).toBeTruthy());
    await act(async () => { window.history.forward(); });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Transformations", level: 1 })).toBeTruthy());
    await user.click(screen.getByRole("link", { name: "Schema" }));
    expect(screen.getByRole("textbox", { name: "Relation name" }).getAttribute("value")).toBe("Local");
    expect(authApi.me).not.toHaveBeenCalled();
    for (const operation of Object.values(projectsApi)) expect(operation).not.toHaveBeenCalled();
    for (const operation of Object.values(api)) expect(operation).not.toHaveBeenCalled();
  });

  it("blocks dirty exit, then discards state before a new Demo entry", async () => {
    const { user, authApi } = mount();
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), "Discard me");
    await user.click(screen.getByRole("link", { name: "Exit demo" }));
    expect(screen.getByRole("heading", { name: "Discard Demo changes?" })).toBe(document.activeElement);
    await user.click(screen.getByRole("button", { name: "Stay" }));
    expect(screen.getByRole("textbox", { name: "Relation name" }).getAttribute("value")).toBe("Discard me");
    await user.click(screen.getByRole("link", { name: "Exit demo" }));
    await user.click(screen.getByRole("button", { name: "Discard and continue" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy());
    expect(authApi.me).toHaveBeenCalled();
    await act(async () => { window.history.back(); });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Relation name" }).getAttribute("value")).toBe(""));
  });
});
