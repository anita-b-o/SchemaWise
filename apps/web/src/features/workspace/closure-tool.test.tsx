import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SchemaWiseApiError, type SchemaWiseApi } from "../../api/schemawise-api";
import type { ClosureResponseDto, SchemaInputDto } from "../../api/schemawise-contracts";
import { SchemaWorkspace } from "./components/SchemaWorkspace";

function apiWith(calculateClosure: SchemaWiseApi["calculateClosure"]): SchemaWiseApi {
  return { analyzeSchema: vi.fn(), calculateClosure: vi.fn(calculateClosure), synthesizeThirdNormalForm: vi.fn(), decomposeBoyceCodd: vi.fn(), analyzeDependencyPreservation: vi.fn() };
}
async function openExample(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Load example" }));
  await user.click(screen.getByText("Tools"));
}
function result(input: SchemaInputDto, closure: readonly string[]): ClosureResponseDto { return { closure }; }
function tool() { const heading = screen.getByRole("heading", { name: "Attribute closure" }); const section = heading.closest("section"); if (!section) throw new Error("Closure tool section missing"); return within(section); }

describe("attribute closure tool", () => {
  it("renders current attributes, supports simple and compound selections, and calculates from draft without analysis", async () => {
    const user = userEvent.setup();
    const api = apiWith(async (input) => result(input, input.relation.attributes.map((attribute) => attribute.id)));
    render(<SchemaWorkspace api={api} />);
    await openExample(user);
    expect(tool().getByRole("checkbox", { name: "A" })).toBeTruthy();
    expect(tool().getByRole("checkbox", { name: "B" })).toBeTruthy();
    await user.click(tool().getByRole("checkbox", { name: "A" }));
    await user.click(tool().getByRole("button", { name: "Calculate closure" }));
    expect(api.analyzeSchema).not.toHaveBeenCalled();
    expect(api.calculateClosure).toHaveBeenCalledWith(expect.objectContaining({ relation: expect.objectContaining({ name: "R" }), functionalDependencies: expect.any(Array), attributes: [expect.any(String)] }), expect.any(AbortSignal));
    expect(await screen.findByText("A⁺ = {A, B, C}")).toBeTruthy();
    await user.click(tool().getByRole("checkbox", { name: "B" }));
    expect((tool().getByRole("checkbox", { name: "A" }) as HTMLInputElement).checked).toBe(true);
    expect((tool().getByRole("checkbox", { name: "B" }) as HTMLInputElement).checked).toBe(true);
  });

  it("allows the empty set and renders empty and non-empty empty-set closures", async () => {
    const user = userEvent.setup();
    const api = apiWith(async (input) => result(input, input.functionalDependencies.length ? [input.relation.attributes[0]!.id, input.relation.attributes[1]!.id] : []));
    render(<SchemaWorkspace api={api} />);
    await openExample(user);
    await user.click(tool().getByRole("button", { name: "Calculate closure" }));
    expect(await screen.findByText("∅⁺ = {A, B}")).toBeTruthy();
    await user.click(tool().getByRole("button", { name: "Calculate again" }));
    expect(await screen.findByText("∅⁺ = {A, B}")).toBeTruthy();
  });

  it("shows loading, network errors, and never sends an invalid draft", async () => {
    const user = userEvent.setup();
    let resolve!: (value: ClosureResponseDto) => void;
    const api = apiWith(() => new Promise<ClosureResponseDto>((res) => { resolve = res; }));
    render(<SchemaWorkspace api={api} />);
    expect((tool().getByRole("button", { name: "Calculate closure" }) as HTMLButtonElement).disabled).toBe(true);
    await openExample(user);
    await user.click(tool().getByRole("button", { name: "Calculate closure" }));
    expect(tool().getByRole("status").textContent).toContain("Calculating");
    resolve({ closure: [] });
    await waitFor(() => expect(screen.getByText("∅⁺ = ∅")).toBeTruthy());

    cleanup();
    const failing = apiWith(async () => { throw new SchemaWiseApiError({ kind: "network", message: "secret" }); });
    render(<SchemaWorkspace api={failing} />);
    await openExample(user);
    await user.click(screen.getByRole("button", { name: "Calculate closure" }));
    expect((await screen.findByRole("alert")).textContent).toContain("We couldn't reach SchemaWise");
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("marks an old result stale, keeps its snapshot labels, and ignores a late result after a newer request", async () => {
    const user = userEvent.setup();
    let call = 0;
    let firstResolve!: (value: ClosureResponseDto) => void;
    const api = apiWith((input) => {
      call += 1;
      if (call === 1) return Promise.resolve(result(input, input.relation.attributes.map((a) => a.id)));
      return new Promise<ClosureResponseDto>((resolve) => { firstResolve = resolve; });
    });
    render(<SchemaWorkspace api={api} />);
    await openExample(user);
    await user.click(tool().getByRole("checkbox", { name: "A" }));
    await user.click(tool().getByRole("button", { name: "Calculate closure" }));
    expect(await screen.findByText("A⁺ = {A, B, C}")).toBeTruthy();
    await user.clear(screen.getByRole("textbox", { name: "Relation name" }));
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), "Changed");
    expect(screen.getByText("Closure result is out of date")).toBeTruthy();
    await user.click(tool().getByRole("button", { name: "Calculate again" }));
    expect(tool().getByRole("button", { name: "Calculating…" })).toBeTruthy();
    firstResolve({ closure: [] });
    expect(screen.getByText("A⁺ = {A, B, C}")).toBeTruthy();
  });

  it("cleans selected attributes when removed and preserves the old snapshot result", async () => {
    const user = userEvent.setup();
    const api = apiWith(async (input) => result(input, input.relation.attributes.map((a) => a.id)));
    render(<SchemaWorkspace api={api} />);
    await openExample(user);
    await user.click(tool().getByRole("checkbox", { name: "B" }));
    await user.click(tool().getByRole("button", { name: "Calculate closure" }));
    expect(await screen.findByText("B⁺ = {A, B, C}")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove attribute B" }));
    await user.click(screen.getByRole("button", { name: "Remove attribute" }));
    expect(tool().queryByRole("checkbox", { name: "B" })).toBeNull();
    expect(screen.getByText("Closure result is out of date")).toBeTruthy();
    expect(screen.getByText("B⁺ = {A, B, C}")).toBeTruthy();
  });
});
