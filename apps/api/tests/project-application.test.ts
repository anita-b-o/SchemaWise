import { describe, expect, it, vi } from "vitest";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
  type NewProject,
  type Project,
  type ProjectDeleteResult,
  type ProjectListQuery,
  type ProjectListResult,
  type ProjectReplacement,
  type ProjectRepository,
  type ProjectUpdateResult,
} from "../src/index.js";

const emptySchema = {
  schemaVersion: 1 as const,
  relation: { name: "", attributes: [] },
  functionalDependencies: [],
};

const timestamp = new Date("2026-09-09T12:00:00.000Z");
const userId = "588a36ef-9d8d-4c90-9339-50e64e20957e";

function stored(overrides: Partial<Project> = {}): Project {
  return {
    id: "31f35669-f936-45c4-a4a2-81364b811c89",
    ownerId: userId,
    name: "Draft",
    schema: emptySchema,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function fakeRepository(overrides: Partial<ProjectRepository> = {}): ProjectRepository {
  return {
    create: vi.fn(async (ownerId: string, project: NewProject) => stored({ ...project, ownerId })),
    findById: vi.fn(async () => stored()),
    list: vi.fn(async (): Promise<ProjectListResult> => ({ projects: [], total: 0 })),
    update: vi.fn(async (_ownerId: string, _id: string, _revision: number, replacement: ProjectReplacement): Promise<ProjectUpdateResult> => ({ kind: "updated", project: stored({ ...replacement, revision: 2 }) })),
    delete: vi.fn(async (): Promise<ProjectDeleteResult> => ({ kind: "deleted" })),
    ...overrides,
  };
}

describe("project application layer", () => {
  it("creates an incomplete draft, trims its name, and generates its ID", async () => {
    const repository = fakeRepository();
    const project = await createProject(repository, userId, { name: "  Draft  ", schema: emptySchema });
    expect(project.name).toBe("Draft");
    expect(project.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(repository.create).toHaveBeenCalledWith(userId, expect.objectContaining({ id: project.id, name: "Draft", schema: emptySchema }));
    expect(repository.create).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ ownerId: expect.anything() }));
  });

  it("takes ownership only from the authenticated user argument", async () => {
    const repository = fakeRepository();
    const input = { name: "Draft", schema: emptySchema, ownerId: "attacker-controlled" };
    const project = await createProject(repository, userId, input);
    expect(project.ownerId).toBe(userId);
    expect(repository.create).toHaveBeenCalledWith(userId, expect.not.objectContaining({ ownerId: expect.anything() }));
  });

  it.each(["", "   "])("rejects invalid project name %j", async (name) => {
    await expect(createProject(fakeRepository(), userId, { name, schema: emptySchema })).rejects.toMatchObject({ code: "INVALID_PROJECT" });
  });

  it("rejects project names over 120 characters", async () => {
    await expect(createProject(fakeRepository(), userId, { name: "x".repeat(121), schema: emptySchema })).rejects.toMatchObject({ code: "PROJECT_LIMIT_EXCEEDED" });
  });

  it("allows zero attributes, an empty relation, and empty attribute names", async () => {
    await expect(createProject(fakeRepository(), userId, { name: "Empty", schema: emptySchema })).resolves.toBeDefined();
    await expect(createProject(fakeRepository(), userId, {
      name: "Unnamed attribute",
      schema: { ...emptySchema, relation: { name: "", attributes: [{ id: "a", name: "" }] } },
    })).resolves.toBeDefined();
  });

  it("rejects more than six attributes", async () => {
    const schema = { ...emptySchema, relation: { name: "", attributes: Array.from({ length: 7 }, (_, index) => ({ id: `a${index}`, name: "" })) } };
    await expect(createProject(fakeRepository(), userId, { name: "Draft", schema })).rejects.toMatchObject({ code: "PROJECT_LIMIT_EXCEEDED" });
  });

  it("rejects more than twelve functional dependencies", async () => {
    const schema = { ...emptySchema, relation: { name: "", attributes: [{ id: "a", name: "" }] }, functionalDependencies: Array.from({ length: 13 }, () => ({ left: [], right: ["a"] })) };
    await expect(createProject(fakeRepository(), userId, { name: "Draft", schema })).rejects.toMatchObject({ code: "PROJECT_LIMIT_EXCEEDED" });
  });

  it("rejects unknown FD references and duplicate IDs on a side", async () => {
    const relation = { name: "", attributes: [{ id: "a", name: "" }] };
    await expect(createProject(fakeRepository(), userId, { name: "Draft", schema: { ...emptySchema, relation, functionalDependencies: [{ left: ["missing"], right: [] }] } })).rejects.toMatchObject({ code: "INVALID_PROJECT", details: expect.objectContaining({ reason: "UNKNOWN_ATTRIBUTE_REFERENCE" }) });
    await expect(createProject(fakeRepository(), userId, { name: "Draft", schema: { ...emptySchema, relation, functionalDependencies: [{ left: ["a", "a"], right: [] }] } })).rejects.toMatchObject({ code: "INVALID_PROJECT", details: expect.objectContaining({ reason: "DUPLICATE_ATTRIBUTE_REFERENCE" }) });
  });

  it("accepts empty FD sides", async () => {
    const schema = { ...emptySchema, functionalDependencies: [{ left: [], right: [] }] };
    await expect(createProject(fakeRepository(), userId, { name: "Draft", schema })).resolves.toBeDefined();
  });

  it("rejects an unknown schema version", async () => {
    await expect(createProject(fakeRepository(), userId, { name: "Draft", schema: { ...emptySchema, schemaVersion: 2 } })).rejects.toMatchObject({ code: "INVALID_PROJECT" });
  });

  it.each([
    [{ limit: 0 }, "INVALID_PROJECT"],
    [{ limit: 101 }, "PROJECT_LIMIT_EXCEEDED"],
    [{ limit: 1.5 }, "INVALID_PROJECT"],
    [{ offset: -1 }, "INVALID_PROJECT"],
    [{ offset: 1.5 }, "INVALID_PROJECT"],
  ])("rejects invalid pagination %j", async (input, code) => {
    await expect(listProjects(fakeRepository(), userId, input)).rejects.toMatchObject({ code });
  });

  it("uses default pagination", async () => {
    const repository = fakeRepository();
    await listProjects(repository, userId);
    expect(repository.list).toHaveBeenCalledWith(userId, { limit: 20, offset: 0 });
  });

  it("scopes get, list, update, and delete repository calls to the authenticated user", async () => {
    const repository = fakeRepository();
    await getProject(repository, userId, "project-id");
    await listProjects(repository, userId, { limit: 5, offset: 2 });
    await updateProject(repository, userId, "project-id", { name: "Updated", schema: emptySchema, expectedRevision: 1 });
    await deleteProject(repository, userId, "project-id");
    expect(repository.findById).toHaveBeenCalledWith(userId, "project-id");
    expect(repository.list).toHaveBeenCalledWith(userId, { limit: 5, offset: 2 });
    expect(repository.update).toHaveBeenCalledWith(userId, "project-id", 1, { name: "Updated", schema: emptySchema });
    expect(repository.delete).toHaveBeenCalledWith(userId, "project-id");
  });

  it("translates get, update, and delete not found outcomes", async () => {
    await expect(getProject(fakeRepository({ findById: vi.fn(async () => null) }), userId, "missing")).rejects.toMatchObject({ code: "PROJECT_NOT_FOUND" });
    await expect(updateProject(fakeRepository({ update: vi.fn(async () => ({ kind: "not-found" })) }), userId, "missing", { name: "Draft", schema: emptySchema, expectedRevision: 1 })).rejects.toMatchObject({ code: "PROJECT_NOT_FOUND" });
    await expect(deleteProject(fakeRepository({ delete: vi.fn(async () => ({ kind: "not-found" })) }), userId, "missing")).rejects.toMatchObject({ code: "PROJECT_NOT_FOUND" });
  });

  it("translates revision conflict with safe details", async () => {
    const repository = fakeRepository({ update: vi.fn(async () => ({ kind: "revision-conflict", actualRevision: 4 })) });
    await expect(updateProject(repository, userId, "project-id", { name: "Draft", schema: emptySchema, expectedRevision: 3 })).rejects.toMatchObject({
      code: "PROJECT_REVISION_CONFLICT",
      details: { projectId: "project-id", expectedRevision: 3, actualRevision: 4 },
    });
  });

  it("rejects invalid expected revisions before calling the repository", async () => {
    const repository = fakeRepository();
    await expect(updateProject(repository, userId, "project-id", { name: "Draft", schema: emptySchema, expectedRevision: 0 })).rejects.toMatchObject({ code: "INVALID_PROJECT" });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("translates unexpected repository failures without leaking their message", async () => {
    const repository = fakeRepository({ create: vi.fn(async () => { throw new Error("password=secret SELECT * FROM projects"); }) });
    const error = await createProject(repository, userId, { name: "Draft", schema: emptySchema }).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "PERSISTENCE_ERROR", message: "The project persistence operation failed." });
    expect(String(error)).not.toContain("secret");
  });
});
