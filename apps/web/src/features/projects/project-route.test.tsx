import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../App";
import type { AuthApi } from "../../api/auth-api";
import { HttpApiError } from "../../api/http-api";
import type { ProjectApi } from "../../api/project-api";
import type { SchemaWiseApi } from "../../api/schemawise-api";
import type { ProjectDto } from "../../api/schemawise-contracts";
import { AuthProvider } from "../auth/auth-context";
import { isCanonicalUuidV4 } from "./project-route-utils";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const authResponse = { user: { id: "user-id", email: "person@example.com" }, csrfToken: "csrf-token" };

function project(id = A, name = "Recovered project", revision = 7): ProjectDto {
  return {
    id,
    name,
    revision,
    schema: {
      schemaVersion: 1,
      relation: { name: "Enrollment", attributes: [{ id: "student-id", name: "Student" }, { id: "course-id", name: "Course" }] },
      functionalDependencies: [{ left: ["student-id"], right: ["course-id"] }],
    },
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-10T00:00:00Z",
  };
}

function authApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return { me: vi.fn(async () => authResponse), register: vi.fn(async () => authResponse), login: vi.fn(async () => authResponse), logout: vi.fn(async () => undefined), ...overrides };
}

function projectsApi(overrides: Partial<ProjectApi> = {}): ProjectApi {
  return {
    createProject: vi.fn(async (input) => ({ ...project(A, input.name), schema: input.schema })),
    listProjects: vi.fn(async () => ({ projects: [], total: 0, limit: 20, offset: 0 })),
    getProject: vi.fn(async (id) => project(id)),
    updateProject: vi.fn(async (id, input) => ({ ...project(id, input.name, input.expectedRevision + 1), schema: input.schema })),
    deleteProject: vi.fn(async () => undefined),
    ...overrides,
  };
}

function computationApi(): SchemaWiseApi {
  return {
    analyzeSchema: vi.fn(),
    calculateClosure: vi.fn(),
    synthesizeThirdNormalForm: vi.fn(),
    decomposeBoyceCodd: vi.fn(),
    analyzeDependencyPreservation: vi.fn(),
  };
}

function RouteNavigation() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate(`/projects/${A}`)}>Go A</button><button onClick={() => navigate(`/projects/${B}`)}>Go B</button></>;
}

function renderRoute(path: string, options: { auth?: AuthApi; projects?: ProjectApi; computations?: SchemaWiseApi; navigation?: boolean; strict?: boolean } = {}) {
  const auth = options.auth ?? authApi();
  const projects = options.projects ?? projectsApi();
  const computations = options.computations ?? computationApi();
  const router = createMemoryRouter([{
    path: "*",
    element: (
      <AuthProvider api={auth}>
        {options.navigation ? <RouteNavigation /> : null}
        <AppRoutes api={computations} projectsApi={projects} />
      </AuthProvider>
    ),
  }], { initialEntries: [path] });
  const tree = <RouterProvider router={router} />;
  render(options.strict ? <StrictMode>{tree}</StrictMode> : tree);
  return { auth, projects, computations, router };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("project routes and hydration", () => {
  it("validates only canonical UUID v4 values", () => {
    expect(isCanonicalUuidV4(A)).toBe(true);
    expect(isCanonicalUuidV4(A.toUpperCase())).toBe(true);
    expect(isCanonicalUuidV4("11111111-1111-5111-8111-111111111111")).toBe(false);
    expect(isCanonicalUuidV4("not-a-project")).toBe(false);
  });

  it("renders a new root workspace and the base title", async () => {
    renderRoute("/");
    expect(screen.getByDisplayValue("Untitled project")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(document.title).toBe("SchemaWise"));
  });

  it("does not reset the root draft when auth initialization rerenders", async () => {
    const session = deferred<typeof authResponse>();
    const user = userEvent.setup();
    renderRoute("/", { auth: authApi({ me: vi.fn(() => session.promise) }) });
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), "Local draft");
    session.resolve(authResponse);
    expect(await screen.findByText("person@example.com")).toBeTruthy();
    expect(screen.getByDisplayValue("Local draft")).toBeTruthy();
  });

  it("rejects an invalid project link without a GET", async () => {
    const client = projectsApi();
    renderRoute("/projects/not-a-project", { projects: client });
    expect(screen.getByRole("heading", { name: "Invalid project link." })).toBeTruthy();
    await Promise.resolve();
    expect(client.getProject).not.toHaveBeenCalled();
  });

  it("waits for unknown auth and does not fetch", async () => {
    const session = deferred<typeof authResponse>();
    const client = projectsApi();
    renderRoute(`/projects/${A}`, { auth: authApi({ me: vi.fn(() => session.promise) }), projects: client });
    expect(screen.getByRole("status").textContent).toBe("Checking your session…");
    expect(client.getProject).not.toHaveBeenCalled();
  });

  it("keeps the deep link available for sign-in, then hydrates", async () => {
    const client = projectsApi();
    const auth = authApi({ me: vi.fn(async () => { throw new HttpApiError({ kind: "api", status: 401, code: "UNAUTHENTICATED", message: "no session" }); }) });
    const user = userEvent.setup();
    renderRoute(`/projects/${A}`, { auth, projects: client });
    expect(await screen.findByRole("heading", { name: "Sign in to open this project." })).toBeTruthy();
    expect(client.getProject).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "password-long");
    await user.click(document.querySelector<HTMLButtonElement>('.auth-form button[type="submit"]')!);
    expect(await screen.findByDisplayValue("Recovered project")).toBeTruthy();
    expect(client.getProject).toHaveBeenCalledWith(A, expect.any(AbortSignal));
  });

  it("shows loading, then installs the exact persisted schema as Saved without computing", async () => {
    const load = deferred<ProjectDto>();
    const client = projectsApi({ getProject: vi.fn(() => load.promise) });
    const computations = computationApi();
    const user = userEvent.setup();
    renderRoute(`/projects/${A}`, { projects: client, computations });
    expect((await screen.findByRole("status")).textContent).toBe("Opening your project…");
    expect(screen.queryByRole("textbox", { name: "Project name" })).toBeNull();
    load.resolve(project());
    expect(await screen.findByDisplayValue("Recovered project")).toBeTruthy();
    expect(screen.getByDisplayValue("Enrollment")).toBeTruthy();
    expect(screen.getByDisplayValue("Student").getAttribute("id")).toBe("attribute-student-id");
    expect(screen.getByDisplayValue("Course").getAttribute("id")).toBe("attribute-course-id");
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(screen.getByText("Define your relation and dependencies, then analyze the schema.")).toBeTruthy();
    for (const method of Object.values(computations)) expect(method).not.toHaveBeenCalled();

    await user.clear(screen.getByRole("textbox", { name: "Project name" }));
    await user.type(screen.getByRole("textbox", { name: "Project name" }), "Changed");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateProject).toHaveBeenCalledWith(A, expect.objectContaining({ expectedRevision: 7 }), "csrf-token"));
  });

  it("maps 404 separately from retryable errors and retries the same route", async () => {
    const user = userEvent.setup();
    renderRoute(`/projects/${A}`, { projects: projectsApi({ getProject: vi.fn(async () => { throw new HttpApiError({ kind: "api", status: 404, code: "PROJECT_NOT_FOUND", message: "missing" }); }) }) });
    expect(await screen.findByRole("heading", { name: "Project not found or unavailable." })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();

    const getProject = vi.fn()
      .mockRejectedValueOnce(new HttpApiError({ kind: "network", message: "offline" }))
      .mockResolvedValueOnce(project());
    renderRoute(`/projects/${A}`, { projects: projectsApi({ getProject }) });
    expect(await screen.findByRole("heading", { name: "Could not load project." })).toBeTruthy();
    expect(document.title).toBe("SchemaWise");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByDisplayValue("Recovered project")).toBeTruthy();
    expect(getProject).toHaveBeenCalledTimes(2);
  });

  it("ignores a late A success after B succeeds, including title and focus", async () => {
    const first = deferred<ProjectDto>();
    const second = deferred<ProjectDto>();
    const getProject = vi.fn((id: string) => id === A ? first.promise : second.promise);
    const user = userEvent.setup();
    renderRoute(`/projects/${A}`, { projects: projectsApi({ getProject }), navigation: true });
    await waitFor(() => expect(getProject).toHaveBeenCalledWith(A, expect.any(AbortSignal)));
    await user.click(screen.getByRole("button", { name: "Go B" }));
    second.resolve(project(B, "Project B", 3));
    expect(await screen.findByDisplayValue("Project B")).toBeTruthy();
    const heading = screen.getByRole("heading", { level: 1, name: "Define a relation and its dependencies." });
    expect(document.activeElement).toBe(heading);
    expect(document.title).toBe("Project B — SchemaWise");
    first.resolve(project(A, "Stale A"));
    await Promise.resolve();
    expect(screen.getByDisplayValue("Project B")).toBeTruthy();
    expect(document.title).toBe("Project B — SchemaWise");
    expect(document.activeElement).toBe(heading);
  });

  it("ignores a late A error after B succeeds", async () => {
    const first = deferred<ProjectDto>();
    const getProject = vi.fn((id: string) => id === A ? first.promise : Promise.resolve(project(B, "Project B")));
    const user = userEvent.setup();
    renderRoute(`/projects/${A}`, { projects: projectsApi({ getProject }), navigation: true });
    await waitFor(() => expect(getProject).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Go B" }));
    expect(await screen.findByDisplayValue("Project B")).toBeTruthy();
    first.reject(new HttpApiError({ kind: "network", message: "late failure" }));
    await Promise.resolve();
    expect(screen.queryByRole("heading", { name: "Could not load project." })).toBeNull();
    expect(screen.getByDisplayValue("Project B")).toBeTruthy();
  });

  it("issues one project GET under StrictMode and focuses only after success", async () => {
    const load = deferred<ProjectDto>();
    const getProject = vi.fn(() => load.promise);
    const { auth } = renderRoute(`/projects/${A}`, { projects: projectsApi({ getProject }), strict: true });
    expect((await screen.findByRole("status")).textContent).toBe("Opening your project…");
    await waitFor(() => expect(getProject).toHaveBeenCalledTimes(1));
    expect(auth.me).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.textContent).not.toBe("Define a relation and its dependencies.");
    load.resolve(project());
    const heading = await screen.findByRole("heading", { level: 1, name: "Define a relation and its dependencies." });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(document.title).toBe("Recovered project — SchemaWise");
  });
});
