import { act, render, screen } from "@testing-library/react";
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

  it("makes a late aborted analysis inert, including host callbacks", async () => {
    const user = userEvent.setup();
    const api = mathematicalApi();
    let resolveAnalysis: ((value: never) => void) | undefined;
    const onAnalyzeSuccess = vi.fn();
    (api.analyzeSchema as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise((resolve) => { resolveAnalysis = resolve; }));
    render(<SharedWorkspaceCore api={api} initialDraft={{ relationName: "R", attributes: [{ id: "a", name: "A" }], functionalDependencies: [] }} onAnalyzeSuccess={onAnalyzeSuccess}>{(core) => <>
      <output data-testid="relation">{core.state.draft.relationName}</output>
      <output data-testid="analysis-status">{core.state.analysis.status}</output>
      <button type="button" onClick={() => void core.analyze()}>Analyze</button>
      <button type="button" onClick={() => core.replaceDraft({ relationName: "Replacement", attributes: [], functionalDependencies: [] })}>Replace</button>
    </>}</SharedWorkspaceCore>);

    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await user.click(screen.getByRole("button", { name: "Replace" }));
    await act(async () => { resolveAnalysis?.({} as never); });
    expect(screen.getByTestId("relation").textContent).toBe("Replacement");
    expect(screen.getByTestId("analysis-status").textContent).toBe("idle");
    expect(onAnalyzeSuccess).not.toHaveBeenCalled();
  });
});
