import { describe, expect, it } from "vitest";
import { isProjectDirty, isRouteLoadedProjectCoherent, shouldAutoRehydrateAfterAuth, type ProjectSession } from "./project-session";

const A = "11111111-1111-4111-8111-111111111111";
const emptyDraft = { relationName: "", attributes: [], functionalDependencies: [] };

describe("project recovery policy", () => {
  it("only auto-rehydrates a clean draft whose loaded identity matches the route", () => {
    expect(shouldAutoRehydrateAfterAuth({ routeProjectId: A, loadedProjectId: A, dirty: false })).toBe(true);
    expect(shouldAutoRehydrateAfterAuth({ routeProjectId: A, loadedProjectId: A, dirty: true })).toBe(false);
    expect(shouldAutoRehydrateAfterAuth({ routeProjectId: A, loadedProjectId: "22222222-2222-4222-8222-222222222222", dirty: false })).toBe(false);
    expect(shouldAutoRehydrateAfterAuth({ routeProjectId: A, dirty: false })).toBe(false);
    expect(isRouteLoadedProjectCoherent(A.toUpperCase(), A)).toBe(true);
  });

  it("defines even an empty detached draft as dirty", () => {
    const detached: ProjectSession = { name: "Untitled project", syncUnavailable: false, detached: true };
    expect(isProjectDirty(detached, emptyDraft)).toBe(true);
  });
});
