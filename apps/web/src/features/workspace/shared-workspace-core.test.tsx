import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SchemaWiseApi } from "../../api/schemawise-api";
import { SharedWorkspaceCore } from "./shared-workspace-core";

function mathematicalApi(): SchemaWiseApi {
  return {
    analyzeSchema: vi.fn(),
    calculateClosure: vi.fn(),
    synthesizeThirdNormalForm: vi.fn(),
    decomposeBoyceCodd: vi.fn(),
    analyzeDependencyPreservation: vi.fn(),
  };
}

describe("shared workspace core", () => {
  it("renders with only the mathematical API and owns draft replacement without project capabilities", async () => {
    const user = userEvent.setup();
    const api = mathematicalApi();
    render(<SharedWorkspaceCore api={api}>{(core) => <>
      <output data-testid="relation">{core.state.draft.relationName || "empty"}</output>
      <button type="button" onClick={() => core.dispatch({ type: "changeRelationName", name: "Local" })}>Edit</button>
      <button type="button" onClick={() => core.replaceDraft({ relationName: "Imported", attributes: [], functionalDependencies: [] })}>Replace</button>
    </>}</SharedWorkspaceCore>);

    expect(screen.getByTestId("relation").textContent).toBe("empty");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByTestId("relation").textContent).toBe("Local");
    await user.click(screen.getByRole("button", { name: "Replace" }));
    expect(screen.getByTestId("relation").textContent).toBe("Imported");
    expect(api.analyzeSchema).not.toHaveBeenCalled();
  });
});
