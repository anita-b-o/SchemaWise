import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../../api/auth-api";
import { HttpApiError } from "../../api/http-api";
import type { ProjectApi } from "../../api/project-api";
import type { ProjectDto, ProjectSummaryDto } from "../../api/schemawise-contracts";
import { AuthProvider } from "../auth/auth-context";
import { AppRoutes } from "../../App";

const authResponse = { user: { id: "user-id", email: "person@example.com" }, csrfToken: "csrf-token" };
const B = "22222222-2222-4222-8222-222222222222";
const exampleSchema = { schemaVersion: 1 as const, relation: { name: "R", attributes: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] }, functionalDependencies: [{ left: ["a"], right: ["b"] }, { left: ["b"], right: ["c"] }] };

function project(name = "Exercise", revision = 1): ProjectDto { return { id: "11111111-1111-4111-8111-111111111111", name, schema: exampleSchema, revision, createdAt: "2026-09-09T12:00:00Z", updatedAt: "2026-09-09T12:00:00Z" }; }
function summary(value = project()): ProjectSummaryDto { return { id: value.id, name: value.name, relationName: value.schema.relation.name, attributeCount: value.schema.relation.attributes.length, functionalDependencyCount: value.schema.functionalDependencies.length, revision: value.revision, createdAt: value.createdAt, updatedAt: value.updatedAt }; }
function authApi(overrides: Partial<AuthApi> = {}): AuthApi { return { me: vi.fn(async () => authResponse), register: vi.fn(async () => authResponse), login: vi.fn(async () => authResponse), logout: vi.fn(async () => undefined), ...overrides }; }
function projectsApi(overrides: Partial<ProjectApi> = {}): ProjectApi {
  return { createProject: vi.fn(async (input) => ({ ...project(input.name), schema: input.schema })), listProjects: vi.fn(async () => ({ projects: [summary()], total: 1, limit: 20, offset: 0 })), getProject: vi.fn(async () => project()), updateProject: vi.fn(async (_id, input) => ({ ...project(input.name, input.expectedRevision + 1), schema: input.schema })), deleteProject: vi.fn(async () => undefined), ...overrides };
}
async function renderAuthenticated(client = projectsApi(), auth = authApi(), initialEntries: string[] = ["/"], initialIndex = initialEntries.length - 1) {
  const user = userEvent.setup();
  const router = createMemoryRouter([{
    path: "*",
    element: <AuthProvider api={auth}><AppRoutes projectsApi={client} /></AuthProvider>,
  }], { initialEntries, initialIndex });
  render(<RouterProvider router={router} />);
  await screen.findByText("person@example.com");
  return { user, client, auth, router };
}
async function openSaved(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Open projects" }));
  await screen.findByRole("heading", { name: "Open projects" });
  await user.click(screen.getByRole("button", { name: /ExerciseR · 3 attributes/ }));
  await screen.findByDisplayValue("Exercise");
}

describe("project persistence UX", () => {
  it("saves a new incomplete draft without analyzing and marks it saved", async () => {
    const { user, client, router } = await renderAuthenticated();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.createProject).toHaveBeenCalledWith({ name: "Untitled project", schema: { schemaVersion: 1, relation: { name: "", attributes: [] }, functionalDependencies: [] } }, "csrf-token"));
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(router.state.location.pathname).toBe(`/projects/${project().id}`);
    expect(client.getProject).not.toHaveBeenCalled();
  });

  it("uses PUT with expectedRevision, and only persisted edits make the project dirty", async () => {
    const client = projectsApi();
    const { user, router } = await renderAuthenticated(client);
    await openSaved(user);
    expect(screen.getByText("Saved")).toBeTruthy();
    const attribute = screen.getByRole("textbox", { name: "Attribute 1 name" });
    await user.clear(attribute); await user.type(attribute, "Account");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateProject).toHaveBeenCalledWith(project().id, expect.objectContaining({ expectedRevision: 1 }), "csrf-token"));
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(router.state.location.pathname).toBe(`/projects/${project().id}`);
    expect(client.getProject).toHaveBeenCalledTimes(1);
  });

  it("confirms before open/new replacement and resets analysis with the draft", async () => {
    const { user } = await renderAuthenticated();
    await user.click(screen.getByRole("button", { name: "Load example" }));
    await user.click(screen.getByRole("button", { name: "Open projects" }));
    await screen.findByRole("heading", { name: "Open projects" });
    await user.click(screen.getByRole("button", { name: /ExerciseR · 3 attributes/ }));
    expect(screen.getByRole("heading", { name: "Unsaved changes" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Discard and continue" }));
    expect(await screen.findByDisplayValue("Exercise")).toBeTruthy();
    await user.clear(screen.getByRole("textbox", { name: "Relation name" }));
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), "Changed");
    await user.click(screen.getByRole("button", { name: "New project" }));
    expect(screen.getByRole("heading", { name: "Unsaved changes" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Discard and continue" }));
    expect(screen.getByDisplayValue("Untitled project")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe("");
  });

  it("shows a non-overwriting OCC conflict and reloads the server version", async () => {
    const getProject = vi.fn().mockResolvedValueOnce(project()).mockResolvedValueOnce(project("Server winner", 2));
    const updateProject = vi.fn(async () => { throw new HttpApiError({ kind: "api", status: 409, code: "PROJECT_REVISION_CONFLICT", message: "conflict" }); });
    const { user } = await renderAuthenticated(projectsApi({ getProject, updateProject }));
    await openSaved(user);
    await user.clear(screen.getByRole("textbox", { name: "Project name" })); await user.type(screen.getByRole("textbox", { name: "Project name" }), "Local edit");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("heading", { name: "This project was updated elsewhere." })).toBeTruthy();
    expect(updateProject).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Reload saved version" }));
    expect(screen.getByText("Discard local changes and reload the saved version?")).toBeTruthy();
    expect(screen.getByDisplayValue("Local edit")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reload and discard" }));
    expect(await screen.findByDisplayValue("Server winner")).toBeTruthy();
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(updateProject).toHaveBeenCalledOnce();
  });

  it("deletes explicitly, preserves current content, and unlinks it as a local draft", async () => {
    const client = projectsApi();
    const { user } = await renderAuthenticated(client);
    await openSaved(user);
    await user.click(screen.getByRole("button", { name: "Open projects" }));
    await user.click(await screen.findByRole("button", { name: "Delete project Exercise" }));
    expect(screen.getByText("Delete “Exercise” permanently?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /^Delete project$/ }));
    await waitFor(() => expect(client.deleteProject).toHaveBeenCalledWith(project().id, "csrf-token"));
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe("R");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
  });

  it("keeps the workspace through logout and requires authentication to save again", async () => {
    const { user } = await renderAuthenticated();
    await user.click(screen.getByRole("button", { name: "Load example" }));
    await user.click(screen.getByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe("R");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("heading", { name: "Sign in to save" })).toBeTruthy();
  });

  it("unlinks a project missing during save so the preserved draft can be created again", async () => {
    const updateProject = vi.fn(async () => { throw new HttpApiError({ kind: "api", status: 404, code: "PROJECT_NOT_FOUND", message: "missing" }); });
    const createProject = vi.fn(async (input) => ({ ...project(input.name), schema: input.schema }));
    const { user } = await renderAuthenticated(projectsApi({ updateProject, createProject }));
    await openSaved(user);
    await user.clear(screen.getByRole("textbox", { name: "Project name" }));
    await user.type(screen.getByRole("textbox", { name: "Project name" }), "Recovered draft");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/can be saved as a new project/)).toBeTruthy();
    expect(screen.getByDisplayValue("Recovered draft")).toBeTruthy();
    expect(screen.getByDisplayValue("R")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createProject).toHaveBeenCalledOnce());
    expect(updateProject).toHaveBeenCalledOnce();
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("announces when the project list is limited to the first 20", async () => {
    const projects = Array.from({ length: 20 }, (_, index) => summary({ ...project(`Project ${index}`), id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}` }));
    const { user } = await renderAuthenticated(projectsApi({ listProjects: vi.fn(async () => ({ projects, total: 21, limit: 20, offset: 0 })) }));
    await user.click(screen.getByRole("button", { name: "Open projects" }));
    expect(await screen.findByText("Showing the 20 most recently updated projects.")).toBeTruthy();
  });

  it("handles 401 without data loss and refreshes CSRF once without retrying a failed mutation", async () => {
    const me = vi.fn().mockResolvedValue(authResponse);
    const createProject = vi.fn()
      .mockRejectedValueOnce(new HttpApiError({ kind: "api", status: 403, code: "INVALID_CSRF_TOKEN", message: "csrf" }))
      .mockRejectedValueOnce(new HttpApiError({ kind: "api", status: 401, code: "UNAUTHENTICATED", message: "expired" }));
    const { user } = await renderAuthenticated(projectsApi({ createProject }), authApi({ me }));
    await user.click(screen.getByRole("button", { name: "Load example" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/security check failed/)).toBeTruthy();
    expect(createProject).toHaveBeenCalledOnce();
    expect(me).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Sign in to continue saving/)).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe("R");
    expect(createProject).toHaveBeenCalledTimes(2);
  });

  it("replaces the root history entry when a new draft is saved", async () => {
    const { user, router } = await renderAuthenticated(projectsApi(), authApi(), ["/before", "/"], 1);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved")).toBeTruthy();
    expect(router.state.location.pathname).toBe(`/projects/${project().id}`);
    await act(async () => { await router.navigate(-1); });
    expect(router.state.location.pathname).toBe("/before");
  });

  it("keeps the project panel open while dirty navigation is blocked and returns focus on Stay", async () => {
    const { user, router } = await renderAuthenticated();
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), "Draft");
    await user.click(screen.getByRole("button", { name: "Open projects" }));
    const openProject = await screen.findByRole("button", { name: /ExerciseR · 3 attributes/ });
    await user.click(openProject);
    expect(router.state.location.pathname).toBe("/");
    expect(screen.getByRole("heading", { name: "Open projects" })).toBeTruthy();
    const promptHeading = screen.getByRole("heading", { name: "Unsaved changes" });
    expect(promptHeading).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(promptHeading));
    await user.click(screen.getByRole("button", { name: "Stay" }));
    expect(router.state.location.pathname).toBe("/");
    expect(screen.getByDisplayValue("Draft")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(openProject));
    await user.click(openProject);
    await user.click(screen.getByRole("button", { name: "Discard and continue" }));
    expect(await screen.findByDisplayValue("Exercise")).toBeTruthy();
    expect(router.state.location.pathname).toBe(`/projects/${project().id}`);
  });

  it("resets root identity, draft, and derived state only after a committed New navigation", async () => {
    const { user, router } = await renderAuthenticated();
    await user.click(screen.getByRole("button", { name: "Load example" }));
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    await user.click(screen.getByRole("button", { name: "New project" }));
    expect(screen.getByRole("heading", { name: "Unsaved changes" })).toBeTruthy();
    expect(screen.getByDisplayValue("R")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Discard and continue" }));
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe(""));
    expect(screen.getByDisplayValue("Untitled project")).toBeTruthy();
    expect(screen.getByText("Not saved")).toBeTruthy();
    expect(screen.getByText("Define your relation and dependencies, then analyze the schema.")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");
  });

  it("protects Back and preserves the original POP for discard, then allows Forward", async () => {
    const getProject = vi.fn(async (id: string) => project(id === B ? "Project B" : "Project A"));
    const client = projectsApi({ getProject: vi.fn(async (id: string) => ({ ...await getProject(id), id })) });
    const { user, router } = await renderAuthenticated(client);
    await act(async () => { await router.navigate(`/projects/${project().id}`); });
    expect(await screen.findByDisplayValue("Project A")).toBeTruthy();
    await act(async () => { await router.navigate(`/projects/${B}`); });
    expect(await screen.findByDisplayValue("Project B")).toBeTruthy();

    await act(async () => { await router.navigate(-1); });
    expect(await screen.findByDisplayValue("Project A")).toBeTruthy();
    await act(async () => { await router.navigate(-1); });
    expect(await screen.findByDisplayValue("Untitled project")).toBeTruthy();
    await act(async () => { await router.navigate(1); });
    expect(await screen.findByDisplayValue("Project A")).toBeTruthy();
    await act(async () => { await router.navigate(1); });
    expect(await screen.findByDisplayValue("Project B")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Relation name" }), { target: { value: "Enrollment dirty" } });

    await act(async () => { await router.navigate(-1); });
    expect(screen.getByRole("heading", { name: "Unsaved changes" })).toBeTruthy();
    expect(router.state.location.pathname).toBe(`/projects/${B}`);
    await user.click(screen.getByRole("button", { name: "Stay" }));
    expect(router.state.location.pathname).toBe(`/projects/${B}`);

    await act(async () => { await router.navigate(-1); });
    await user.click(screen.getByRole("button", { name: "Discard and continue" }));
    expect(await screen.findByDisplayValue("Project A")).toBeTruthy();
    expect(router.state.location.pathname).toBe(`/projects/${project().id}`);
    await act(async () => { await router.navigate(1); });
    expect(await screen.findByDisplayValue("Project B")).toBeTruthy();
    expect(router.state.location.pathname).toBe(`/projects/${B}`);
  });

  it("navigates a clean loaded project to a new root workspace", async () => {
    const { user, router } = await renderAuthenticated();
    await openSaved(user);
    await user.click(screen.getByRole("button", { name: "New project" }));
    expect(await screen.findByDisplayValue("Untitled project")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe("");
    expect(router.state.location.pathname).toBe("/");
    expect(screen.queryByRole("heading", { name: "Unsaved changes" })).toBeNull();
  });

  it("registers beforeunload only while dirty and removes it after Save", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { user } = await renderAuthenticated();
    expect(add.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(0);
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), "Draft");
    await waitFor(() => expect(add.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(1));
    const handler = add.mock.calls.find(([type]) => type === "beforeunload")?.[1];
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved")).toBeTruthy();
    await waitFor(() => expect(remove).toHaveBeenCalledWith("beforeunload", handler));
    add.mockRestore();
    remove.mockRestore();
  });

  it("removes the old draft unload handler after discard navigation", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { user } = await renderAuthenticated();
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), "Draft");
    await waitFor(() => expect(add.mock.calls.some(([type]) => type === "beforeunload")).toBe(true));
    const handler = add.mock.calls.find(([type]) => type === "beforeunload")?.[1];
    await user.click(screen.getByRole("button", { name: "Open projects" }));
    await user.click(await screen.findByRole("button", { name: /ExerciseR · 3 attributes/ }));
    await user.click(screen.getByRole("button", { name: "Discard and continue" }));
    expect(await screen.findByDisplayValue("Exercise")).toBeTruthy();
    await waitFor(() => expect(remove).toHaveBeenCalledWith("beforeunload", handler));
    add.mockRestore();
    remove.mockRestore();
  });
});
