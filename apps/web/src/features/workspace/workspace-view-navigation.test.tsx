import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../App";
import type { AuthApi } from "../../api/auth-api";
import { HttpApiError } from "../../api/http-api";
import type { ProjectApi } from "../../api/project-api";
import type { SchemaWiseApi } from "../../api/schemawise-api";
import type { ProjectDto } from "../../api/schemawise-contracts";
import { AuthProvider } from "../auth/auth-context";
import { WorkspaceViewProvider, useWorkspaceView } from "./workspace-view-navigation";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const authResponse = { user: { id: "user-id", email: "person@example.com" }, csrfToken: "csrf-token" };
const schema = { schemaVersion: 1 as const, relation: { name: "R", attributes: [{ id: "a", name: "A" }] }, functionalDependencies: [] };

function project(id = A, name = "Project A", revision = 1): ProjectDto {
  return { id, name, revision, schema, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" };
}
function projectsApi(overrides: Partial<ProjectApi> = {}): ProjectApi {
  return {
    getProject: vi.fn(async (id) => project(id, id === B ? "Project B" : "Project A")),
    createProject: vi.fn(async (input) => ({ ...project(B, input.name), schema: input.schema })),
    updateProject: vi.fn(async (id, input) => ({ ...project(id, input.name, input.expectedRevision + 1), schema: input.schema })),
    deleteProject: vi.fn(async () => undefined),
    listProjects: vi.fn(async () => ({ projects: [project(A), project(B, "Project B")].map((p) => ({ id: p.id, name: p.name, relationName: "R", attributeCount: 1, functionalDependencyCount: 0, revision: p.revision, createdAt: p.createdAt, updatedAt: p.updatedAt })), total: 2, limit: 20, offset: 0 })),
    ...overrides,
  };
}
function authApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return { me: vi.fn(async () => authResponse), register: vi.fn(async () => authResponse), login: vi.fn(async () => authResponse), logout: vi.fn(async () => undefined), ...overrides };
}
function computations(): SchemaWiseApi {
  return { analyzeSchema: vi.fn(), calculateClosure: vi.fn(), synthesizeThirdNormalForm: vi.fn(), decomposeBoyceCodd: vi.fn(), analyzeDependencyPreservation: vi.fn() };
}
function ViewControl() {
  const view = useWorkspaceView();
  return <div data-testid="view-control"><output data-testid="active-view">{view.activeView}</output><button onClick={view.goToSchema}>Go Schema</button><button onClick={view.goToAnalysis}>Go Analysis</button><button onClick={view.goToTransform}>Go Transform</button></div>;
}
function setup(path = "/", options: { projects?: ProjectApi; auth?: AuthApi; computations?: SchemaWiseApi; strict?: boolean } = {}) {
  const user = userEvent.setup();
  const client = options.projects ?? projectsApi();
  const auth = options.auth ?? authApi();
  const api = options.computations ?? computations();
  const router = createMemoryRouter([{ path: "*", element: <AuthProvider api={auth}><WorkspaceViewProvider><ViewControl /><AppRoutes api={api} projectsApi={client} /></WorkspaceViewProvider></AuthProvider> }], { initialEntries: [path] });
  const tree = <RouterProvider router={router} />;
  render(options.strict ? <StrictMode>{tree}</StrictMode> : tree);
  return { user, router, client, auth, api };
}
function view() { return screen.getByTestId("active-view").textContent; }
function url(router: ReturnType<typeof setup>["router"]) { return router.state.location.pathname + router.state.location.search; }

describe("workspace view navigation", () => {
  it("has no automated axe violations in the unchanged workspace presentation", async () => {
    const router = createMemoryRouter([{ path: "*", element: <AuthProvider api={authApi()}><AppRoutes projectsApi={projectsApi()} api={computations()} /></AuthProvider> }], { initialEntries: ["/?view=transform"] });
    render(<RouterProvider router={router} />);
    await screen.findByText("person@example.com");
    expect((await axe.run(document.body)).violations).toEqual([]);
  });

  it("pushes history and preserves a dirty root draft, focus, unrelated params, and zero network requests", async () => {
    const { user, router, client, auth } = setup("/?campaign=abc");
    await screen.findByText("person@example.com");
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), "Local draft");
    const input = screen.getByRole("textbox", { name: "Relation name" });
    input.focus();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await user.click(screen.getByRole("button", { name: "Go Analysis" }));
    expect(url(router)).toBe("/?campaign=abc&view=analysis");
    expect(view()).toBe("analysis");
    expect(screen.getByRole("textbox", { name: "Relation name" })).toBe(input);
    expect(screen.getByDisplayValue("Local draft")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Unsaved changes" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Go Transform" }));
    expect(view()).toBe("transform");
    await act(async () => { await router.navigate(-1); });
    expect(view()).toBe("analysis");
    await act(async () => { await router.navigate(-1); });
    expect(view()).toBe("schema");
    await act(async () => { await router.navigate(1); });
    expect(view()).toBe("analysis");
    await user.click(screen.getByRole("button", { name: "Go Schema" }));
    expect(url(router)).toBe("/?campaign=abc");
    expect(screen.getByRole("textbox", { name: "Relation name" })).toBe(input);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(client.getProject).not.toHaveBeenCalled();
    expect(auth.me).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it("hydrates a direct project view once under StrictMode; surface changes do not restart an in-flight GET", async () => {
    let resolve!: (value: ProjectDto) => void;
    const pending = new Promise<ProjectDto>((done) => { resolve = done; });
    const getProject = vi.fn((_id: string, _signal?: AbortSignal) => pending);
    const { user, router, auth, api } = setup(`/projects/${A}?view=analysis`, { projects: projectsApi({ getProject }), strict: true });
    await waitFor(() => expect(getProject).toHaveBeenCalledTimes(1));
    const signal = getProject.mock.calls[0]?.[1];
    await user.click(screen.getByRole("button", { name: "Go Transform" }));
    expect(signal?.aborted).toBe(false);
    expect(getProject).toHaveBeenCalledTimes(1);
    await act(async () => resolve(project()));
    expect(await screen.findByDisplayValue("Project A")).toBeTruthy();
    expect(view()).toBe("transform");
    await user.click(screen.getByRole("button", { name: "Go Analysis" }));
    expect(url(router)).toBe(`/projects/${A}?view=analysis`);
    expect(getProject).toHaveBeenCalledTimes(1);
    expect(auth.me).toHaveBeenCalledTimes(1);
    expect(api.analyzeSchema).not.toHaveBeenCalled();
    expect(screen.getByText("Define your relation and dependencies, then analyze the schema.")).toBeTruthy();
  });

  it("keeps a computed result mounted across view changes without running Analyze again", async () => {
    const analyzeSchema = vi.fn<SchemaWiseApi["analyzeSchema"]>(async (input) => ({
      relation: input.relation,
      candidateKeys: [["a"]],
      primeAttributes: ["a"],
      minimalCover: [],
      normalForms: { second: { satisfied: true, violations: [] }, third: { satisfied: true, violations: [] }, bcnf: { satisfied: true, violations: [] } },
    }));
    const { user, client } = setup(`/projects/${A}`, { computations: { ...computations(), analyzeSchema } });
    expect(await screen.findByDisplayValue("Project A")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    const result = (await screen.findByRole("heading", { name: "R(A)" })).closest("article");
    await user.click(screen.getByRole("button", { name: "Go Analysis" }));
    await user.click(screen.getByRole("button", { name: "Go Transform" }));
    await user.click(screen.getByRole("button", { name: "Go Schema" }));
    expect(screen.getByRole("heading", { name: "R(A)" }).closest("article")).toBe(result);
    expect(analyzeSchema).toHaveBeenCalledTimes(1);
    expect(client.getProject).toHaveBeenCalledTimes(1);
  });

  it("does not move focus when a view URL changes without a visual control", async () => {
    const { router } = setup("/");
    const input = screen.getByRole("textbox", { name: "Relation name" });
    input.focus();
    await act(async () => { await router.navigate("/?view=analysis"); });
    expect(document.activeElement).toBe(input);
    expect(view()).toBe("analysis");
  });

  it("restores view intent without restoring anonymous analysis on root refresh", async () => {
    const { api, client } = setup("/?view=analysis");
    expect(view()).toBe("analysis");
    expect(screen.getByText("Define your relation and dependencies, then analyze the schema.")).toBeTruthy();
    expect(api.analyzeSchema).not.toHaveBeenCalled();
    expect(client.getProject).not.toHaveBeenCalled();
  });

  it("saves a new root draft while retaining Analysis and avoiding a redundant GET", async () => {
    const { user, router, client } = setup("/?view=analysis");
    await screen.findByText("person@example.com");
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), "Draft");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.createProject).toHaveBeenCalledTimes(1));
    expect(url(router)).toBe(`/projects/${B}?view=analysis`);
    expect(view()).toBe("analysis");
    expect(screen.getByDisplayValue("Draft")).toBeTruthy();
    expect(client.getProject).not.toHaveBeenCalled();
  });

  it("keeps the same history entry and view on PUT", async () => {
    const { user, router, client } = setup(`/projects/${A}?view=transform`);
    expect(await screen.findByDisplayValue("Project A")).toBeTruthy();
    const key = router.state.location.key;
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), " edit");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateProject).toHaveBeenCalledWith(A, expect.objectContaining({ expectedRevision: 1 }), "csrf-token"));
    expect(url(router)).toBe(`/projects/${A}?view=transform`);
    expect(router.state.location.key).toBe(key);
    expect(view()).toBe("transform");
  });

  it("blocks resource changes while dirty and opens another project on Schema after discard", async () => {
    const { user, router, client } = setup(`/projects/${A}?view=analysis`);
    expect(await screen.findByDisplayValue("Project A")).toBeTruthy();
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), " dirty");
    await user.click(screen.getByRole("button", { name: "Go Transform" }));
    expect(screen.queryByRole("heading", { name: "Unsaved changes" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Open projects" }));
    await user.click((await screen.findByText("Project B")).closest("button")!);
    expect(screen.getByRole("heading", { name: "Unsaved changes" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Discard and continue" }));
    expect(await screen.findByDisplayValue("Project B")).toBeTruthy();
    expect(url(router)).toBe(`/projects/${B}`);
    expect(view()).toBe("schema");
    expect(client.getProject).toHaveBeenCalledTimes(2);
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), " dirty");
    await user.click(screen.getByRole("button", { name: "New project" }));
    expect(screen.getByRole("heading", { name: "Unsaved changes" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Discard and continue" }));
    expect(await screen.findByDisplayValue("Untitled project")).toBeTruthy();
    expect(url(router)).toBe("/");
  });

  it("keeps the view through logout, clean reconnect, and OCC reload", async () => {
    const getProject = vi.fn().mockResolvedValueOnce(project()).mockResolvedValueOnce(project(A, "After login", 2)).mockResolvedValueOnce(project(A, "Server winner", 3));
    const updateProject = vi.fn(async () => { throw new HttpApiError({ kind: "api", status: 409, code: "PROJECT_REVISION_CONFLICT", message: "conflict" }); });
    const { user, router } = setup(`/projects/${A}?view=analysis`, { projects: projectsApi({ getProject, updateProject }) });
    expect(await screen.findByDisplayValue("Project A")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Log out" }));
    expect(url(router)).toBe(`/projects/${A}?view=analysis`);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "password-long");
    await user.click(document.querySelector<HTMLButtonElement>('.auth-form button[type="submit"]')!);
    expect(await screen.findByDisplayValue("After login")).toBeTruthy();
    expect(getProject).toHaveBeenCalledTimes(2);
    expect(view()).toBe("analysis");
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), " dirty");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("heading", { name: "This project was updated elsewhere." })).toBeTruthy();
    expect(url(router)).toBe(`/projects/${A}?view=analysis`);
    await user.click(screen.getByRole("button", { name: "Reload saved version" }));
    await user.click(screen.getByRole("button", { name: "Reload and discard" }));
    expect(await screen.findByDisplayValue("Server winner")).toBeTruthy();
    expect(view()).toBe("analysis");
    expect(getProject).toHaveBeenCalledTimes(3);
  });

  it("keeps a dirty view across logout/login without GET and resets to Schema on PUT 404 detachment", async () => {
    const getProject = vi.fn(async () => project());
    const updateProject = vi.fn(async () => { throw new HttpApiError({ kind: "api", status: 404, code: "PROJECT_NOT_FOUND", message: "missing" }); });
    const { user, router } = setup(`/projects/${A}?view=analysis`, { projects: projectsApi({ getProject, updateProject }) });
    expect(await screen.findByDisplayValue("Project A")).toBeTruthy();
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), " local");
    await user.click(screen.getByRole("button", { name: "Log out" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "password-long");
    await user.click(document.querySelector<HTMLButtonElement>('.auth-form button[type="submit"]')!);
    expect(await screen.findByText("Signed in. This project has unsaved local changes.")).toBeTruthy();
    expect(getProject).toHaveBeenCalledTimes(1);
    expect(view()).toBe("analysis");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Your changes are still here/)).toBeTruthy();
    expect(url(router)).toBe("/");
    expect(view()).toBe("schema");
    expect(screen.getByDisplayValue("R local")).toBeTruthy();
  });

  it("returns a deleted current project to root Schema while keeping its detached draft", async () => {
    const { user, router, client } = setup(`/projects/${A}?view=transform`);
    expect(await screen.findByDisplayValue("Project A")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Open projects" }));
    await user.click(await screen.findByRole("button", { name: "Delete project Project A" }));
    await user.click(screen.getByRole("button", { name: /^Delete project$/ }));
    await waitFor(() => expect(url(router)).toBe("/"));
    await waitFor(() => expect(view()).toBe("schema"));
    expect(screen.getByDisplayValue("R")).toBeTruthy();
    expect(client.deleteProject).toHaveBeenCalledWith(A, "csrf-token");
  });

  it("returns a missing OCC reload to root Schema with the local draft", async () => {
    const getProject = vi.fn().mockResolvedValueOnce(project()).mockRejectedValueOnce(new HttpApiError({ kind: "api", status: 404, code: "PROJECT_NOT_FOUND", message: "missing" }));
    const updateProject = vi.fn(async () => { throw new HttpApiError({ kind: "api", status: 409, code: "PROJECT_REVISION_CONFLICT", message: "conflict" }); });
    const { user, router } = setup(`/projects/${A}?view=analysis`, { projects: projectsApi({ getProject, updateProject }) });
    expect(await screen.findByDisplayValue("Project A")).toBeTruthy();
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), " local");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Reload saved version" }));
    await user.click(screen.getByRole("button", { name: "Reload and discard" }));
    await waitFor(() => expect(url(router)).toBe("/"));
    expect(view()).toBe("schema");
    expect(screen.getByDisplayValue("R local")).toBeTruthy();
    expect(getProject).toHaveBeenCalledTimes(2);
  });
});
