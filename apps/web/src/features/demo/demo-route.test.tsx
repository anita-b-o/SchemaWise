import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import type { AuthApi } from "../../api/auth-api";
import { HttpApiError } from "../../api/http-api";
import type { ProjectApi } from "../../api/project-api";
import type { SchemaWiseApi } from "../../api/schemawise-api";
import type { AnalysisResponseDto, SchemaAnalysisRequestDto } from "../../api/schemawise-contracts";
import { workspaceResourceIdentity } from "../projects/workspace-resource-identity";

function clients() {
  const authApi: AuthApi = { me: vi.fn(async () => { throw new HttpApiError({ kind: "api", status: 401, code: "UNAUTHORIZED", message: "No session" }); }), login: vi.fn(), register: vi.fn(), logout: vi.fn() };
  const projectsApi: ProjectApi = { getProject: vi.fn(), listProjects: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(), deleteProject: vi.fn() };
  const api: SchemaWiseApi = { analyzeSchema: vi.fn(), calculateClosure: vi.fn(), synthesizeThirdNormalForm: vi.fn(), decomposeBoyceCodd: vi.fn(), analyzeDependencyPreservation: vi.fn() };
  return { authApi, projectsApi, api };
}

function analysisFor(input: SchemaAnalysisRequestDto): AnalysisResponseDto {
  const [a, b, c] = input.relation.attributes.map((attribute) => attribute.id);
  if (!a || !b || !c) throw new Error("Demo analysis fixture requires three attributes");
  return { relation: input.relation, candidateKeys: [[a]], primeAttributes: [a], minimalCover: input.functionalDependencies, normalForms: { second: { satisfied: true, violations: [] }, third: { satisfied: false, violations: [{ determinant: [b], dependent: c }] }, bcnf: { satisfied: false, violations: [{ determinant: [b], dependent: c }] } } };
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
    expect((screen.getByRole("combobox", { name: "Example" }) as HTMLSelectElement).value).toBe("basic-normalization");
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
    expect(screen.getByRole("textbox", { name: "Relation name" }).getAttribute("value")).toBe("RLocal");
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
    expect(screen.getByRole("textbox", { name: "Relation name" }).getAttribute("value")).toBe("RDiscard me");
    await user.click(screen.getByRole("link", { name: "Exit demo" }));
    await user.click(screen.getByRole("button", { name: "Discard and continue" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy());
    expect(authApi.me).toHaveBeenCalled();
    await act(async () => { window.history.back(); });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Relation name" }).getAttribute("value")).toBe("R"));
  });

  it("replaces a clean example immediately and lets a user start from scratch without network activity", async () => {
    const { user, api, authApi, projectsApi } = mount();
    const picker = screen.getByRole("combobox", { name: "Example" });
    await user.selectOptions(picker, "composite-key");
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe("R");
    expect((screen.getByRole("textbox", { name: "Attribute 1 name" }) as HTMLInputElement).value).toBe("A");
    expect(screen.getByText(/Explore how a dependency on part of a composite key/)).toBeTruthy();
    await user.selectOptions(picker, "blank");
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Build a relation from an empty schema.")).toBeTruthy();
    for (const operation of Object.values(api)) expect(operation).not.toHaveBeenCalled();
    expect(authApi.me).not.toHaveBeenCalled();
    for (const operation of Object.values(projectsApi)) expect(operation).not.toHaveBeenCalled();
  });

  it("confirms replacement only for a modified draft, preserves work on cancel, and restores focus", async () => {
    const { user } = mount();
    const picker = screen.getByRole("combobox", { name: "Example" });
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), " changed");
    await user.selectOptions(picker, "enrollment");
    expect(screen.getByRole("heading", { name: "Replace current example?" })).toBe(document.activeElement);
    expect(screen.getByText("Your changes and analysis results will be discarded.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Keep working" }));
    expect(picker).toBe(document.activeElement);
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe("R changed");
    await user.selectOptions(picker, "enrollment");
    await user.click(screen.getByRole("button", { name: "Replace example" }));
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe("Enrollment");
    expect((screen.getByRole("combobox", { name: "Example" }) as HTMLSelectElement).value).toBe("enrollment");
  });

  it("does not reset a selected example when it is selected again", async () => {
    const { user, api } = mount();
    const picker = screen.getByRole("combobox", { name: "Example" });
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), " local");
    await user.selectOptions(picker, "basic-normalization");
    expect(screen.queryByRole("heading", { name: "Replace current example?" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe("R local");
    for (const operation of Object.values(api)) expect(operation).not.toHaveBeenCalled();
  });

  it("uses the real analysis operation once and replacement aborts an in-flight request", async () => {
    const { user, api } = mount();
    let capturedSignal: AbortSignal | undefined;
    (api.analyzeSchema as ReturnType<typeof vi.fn>).mockImplementation((_, signal?: AbortSignal) => {
      capturedSignal = signal;
      return new Promise<AnalysisResponseDto>(() => undefined);
    });
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    expect(api.analyzeSchema).toHaveBeenCalledTimes(1);
    await user.selectOptions(screen.getByRole("combobox", { name: "Example" }), "composite-key");
    expect(capturedSignal?.aborted).toBe(true);
    expect(screen.getByRole("heading", { name: "Define a relation and its dependencies." })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Example" }) as HTMLSelectElement).value).toBe("composite-key");
  });

  it("keeps dirty and stale distinct after a real analysis", async () => {
    const { user, api } = mount();
    (api.analyzeSchema as ReturnType<typeof vi.fn>).mockImplementation(async (input: SchemaAnalysisRequestDto) => analysisFor(input));
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    await screen.findByRole("heading", { name: "Analysis" });
    await user.click(screen.getByRole("link", { name: "Edit schema" }));
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), " changed");
    await user.click(screen.getByRole("link", { name: "Analysis" }));
    expect(screen.getByText("Results are out of date")).toBeTruthy();
    expect(screen.getByText("Local changes")).toBeTruthy();
  });
});
