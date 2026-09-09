import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SchemaWiseApiError, type SchemaWiseApi } from "../../api/schemawise-api";
import type { AnalysisResponseDto, BcnfDecompositionResponseDto, DependencyPreservationRequestDto, DependencyPreservationResponseDto, SchemaInputDto, ThirdNormalFormSynthesisResponseDto } from "../../api/schemawise-contracts";
import { SchemaWorkspace } from "./components/SchemaWorkspace";

function analysisFor(input: SchemaInputDto, satisfied = false): AnalysisResponseDto {
  const [a, b, c] = input.relation.attributes.map((attribute) => attribute.id);
  if (!a || !b || !c) throw new Error("Expected three attributes");
  return {
    relation: input.relation,
    candidateKeys: [[a]],
    primeAttributes: [a],
    minimalCover: [{ left: [a], right: [b] }, { left: [b], right: [c] }],
    normalForms: {
      second: { satisfied: true, violations: [] },
      third: { satisfied, violations: satisfied ? [] : [{ determinant: [b], dependent: c }] },
      bcnf: { satisfied, violations: satisfied ? [] : [{ determinant: [b], dependent: c }] },
    },
  };
}

function synthesisFor(input: SchemaInputDto, added = false): ThirdNormalFormSynthesisResponseDto {
  const [a, b, c] = input.relation.attributes.map((attribute) => attribute.id) as [string, string, string];
  return {
    relations: [
      { attributes: [a, b], source: "minimal-cover" },
      { attributes: [b, c], source: "minimal-cover" },
      ...(added ? [{ attributes: [a, c], source: "candidate-key" as const }] : []),
    ],
    minimalCover: [{ left: [a], right: [b] }, { left: [b], right: [c] }],
    addedCandidateKey: added ? [a, c] : null,
  };
}

function bcnfFor(input: SchemaInputDto): BcnfDecompositionResponseDto {
  const [a, b, c] = input.relation.attributes.map((attribute) => attribute.id) as [string, string, string];
  return {
    relations: [{ attributes: [b, c] }, { attributes: [a, b] }],
    steps: [{ source: [a, b, c], violation: { determinant: [b], dependent: c }, result: [[b, c], [a, b]] }],
  };
}

const preserved: DependencyPreservationResponseDto = { preserved: true, preservedDependencies: [{ left: ["a"], right: ["b"] }], lostDependencies: [] };

function apiWith(overrides: Partial<SchemaWiseApi> = {}): SchemaWiseApi {
  return {
    analyzeSchema: vi.fn(async (input) => analysisFor(input)),
    calculateClosure: vi.fn(),
    synthesizeThirdNormalForm: vi.fn(async (input) => synthesisFor(input)),
    decomposeBoyceCodd: vi.fn(async (input) => bcnfFor(input)),
    analyzeDependencyPreservation: vi.fn(async () => preserved),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function analyzeExample(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Load example" }));
  await user.click(screen.getByRole("button", { name: "Analyze schema" }));
  await screen.findByRole("heading", { name: "Transformations" });
}

describe("normalization transformations", () => {
  it("shows transformation CTAs only for violated normal forms", async () => {
    const user = userEvent.setup();
    const api = apiWith();
    const view = render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    expect(screen.getByRole("button", { name: "Generate 3NF synthesis" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate BCNF decomposition" })).toBeTruthy();

    view.unmount();
    const satisfiedApi = apiWith({ analyzeSchema: vi.fn(async (input) => analysisFor(input, true)) });
    render(<SchemaWorkspace api={satisfiedApi} />);
    await user.click(screen.getByRole("button", { name: "Load example" }));
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    await screen.findByRole("heading", { name: "R(A, B, C)" });
    expect(screen.queryByRole("button", { name: /Generate 3NF synthesis/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Generate BCNF decomposition/ })).toBeNull();
  });

  it("uses the analyzed snapshot and renders synthesis sources, cover and guarantees", async () => {
    const user = userEvent.setup();
    const api = apiWith({ synthesizeThirdNormalForm: vi.fn(async (input) => synthesisFor(input, true)) });
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis" }));

    const request = vi.mocked(api.synthesizeThirdNormalForm).mock.calls[0]![0];
    expect(request.relation.name).toBe("R");
    const section = screen.getByRole("heading", { name: "3NF synthesis" }).closest("section")!;
    expect(within(section).getByText("{A, B}")).toBeTruthy();
    expect(within(section).getByText("{B, C}")).toBeTruthy();
    expect(within(section).getAllByText("Derived from minimal cover")).toHaveLength(2);
    expect(within(section).getByText("Added to contain a candidate key")).toBeTruthy();
    expect(within(section).getByText("Additional candidate-key relation")).toBeTruthy();
    expect(within(section).getByText(/none of the synthesized relations contained a candidate key/)).toBeTruthy();
    expect(within(section).getByText(/preserves the functional dependencies and produces a lossless decomposition/)).toBeTruthy();
    expect(within(section).getByText("Minimal cover used").closest("details")?.open).toBe(false);
  });

  it("does not render an empty candidate-key section when none was added", async () => {
    const user = userEvent.setup();
    render(<SchemaWorkspace api={apiWith()} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis" }));
    expect(screen.queryByText("Additional candidate-key relation")).toBeNull();
  });

  it("announces synthesis loading and retains its previous result after failure", async () => {
    const user = userEvent.setup();
    const retry = deferred<ThirdNormalFormSynthesisResponseDto>();
    let calls = 0;
    const api = apiWith({ synthesizeThirdNormalForm: vi.fn(async (input) => ++calls === 1 ? synthesisFor(input) : retry.promise) });
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis" }));
    await screen.findByRole("heading", { name: "3NF synthesis" });
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis again" }));
    expect(screen.getByText("Updating synthesis…")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "3NF synthesis" })).toBeTruthy();
    retry.reject(new SchemaWiseApiError({ kind: "network", message: "secret stack" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Unable to generate 3NF synthesis.");
    expect(alert.textContent).not.toContain("secret stack");
    expect(screen.getByRole("heading", { name: "3NF synthesis" })).toBeTruthy();
  });

  it("renders BCNF leaves, formatted steps and distinct guarantees", async () => {
    const user = userEvent.setup();
    const api = apiWith();
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate BCNF decomposition" }));
    const section = (await screen.findByRole("heading", { name: "BCNF decomposition" })).closest("section")!;
    expect(within(section).getByText("Final relations")).toBeTruthy();
    expect(within(section).getAllByText("{B, C}").length).toBeGreaterThan(0);
    expect(within(section).getByText("Step 1")).toBeTruthy();
    expect(within(section).getByText("R(A, B, C)")).toBeTruthy();
    expect(within(section).getByText("B → C")).toBeTruthy();
    expect(within(section).getByText("Every final relation satisfies BCNF. The decomposition is lossless.")).toBeTruthy();
    expect(within(section).getByText("Dependency preservation is not guaranteed by BCNF decomposition.")).toBeTruthy();
    expect(within(section).getByText(/reconstructed without losing information/)).toBeTruthy();
    expect(within(section).getByText(/checked locally without recomposing relations/)).toBeTruthy();
  });

  it("uses BCNF leaf relations for an explicit preservation request and renders preserved", async () => {
    const user = userEvent.setup();
    const api = apiWith();
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate BCNF decomposition" }));
    await user.click(await screen.findByRole("button", { name: "Check dependency preservation" }));
    const request = vi.mocked(api.analyzeDependencyPreservation).mock.calls[0]![0];
    expect(request.relation.name).toBe("R");
    expect(request.decomposition).toEqual([[request.relation.attributes[1]!.id, request.relation.attributes[2]!.id], [request.relation.attributes[0]!.id, request.relation.attributes[1]!.id]]);
    expect(await screen.findByText("✓ Preserved")).toBeTruthy();
    expect(screen.getByText(/remain derivable from the projected dependencies/)).toBeTruthy();
  });

  it("renders lost dependencies first without describing data loss", async () => {
    const user = userEvent.setup();
    const api = apiWith({ analyzeDependencyPreservation: vi.fn(async (input: DependencyPreservationRequestDto) => {
      const [a, b, c] = input.relation.attributes.map((attribute) => attribute.id) as [string, string, string];
      return { preserved: false, lostDependencies: [{ left: [a, b], right: [c] }], preservedDependencies: [{ left: [b], right: [c] }] };
    }) });
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate BCNF decomposition" }));
    await user.click(await screen.findByRole("button", { name: "Check dependency preservation" }));
    const heading = await screen.findByRole("heading", { name: "Dependency preservation" });
    const section = heading.closest("section")!;
    expect(within(section).getByText("× Not preserved")).toBeTruthy();
    expect(within(section).getByText("Lost dependencies")).toBeTruthy();
    expect(within(section).getByText("A, B → C")).toBeTruthy();
    expect(within(section).getByText("Preserved dependencies").compareDocumentPosition(within(section).getByText("Lost dependencies")) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(section.textContent?.toLowerCase()).not.toContain("data loss");
  });

  it("keeps old snapshot results visible when stale and disables every new transformation", async () => {
    const user = userEvent.setup();
    const api = apiWith();
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis" }));
    await user.click(screen.getByRole("button", { name: "Generate BCNF decomposition" }));
    await user.click(await screen.findByRole("button", { name: "Check dependency preservation" }));
    await screen.findByText("✓ Preserved");
    await user.clear(screen.getByRole("textbox", { name: "Attribute 1 name" }));
    await user.type(screen.getByRole("textbox", { name: "Attribute 1 name" }), "Changed");

    expect(screen.getByText("Analyze the updated schema before generating a transformation.")).toBeTruthy();
    for (const name of [/Generate 3NF synthesis again/, /Generate BCNF decomposition again/, /Check dependency preservation again/]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByRole("heading", { name: "3NF synthesis" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "BCNF decomposition" })).toBeTruthy();
    expect(screen.getByText("✓ Preserved")).toBeTruthy();
  });

  it("clears all transformation resources after successful analysis of a new revision", async () => {
    const user = userEvent.setup();
    const api = apiWith();
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis" }));
    await user.click(screen.getByRole("button", { name: "Generate BCNF decomposition" }));
    await user.click(await screen.findByRole("button", { name: "Check dependency preservation" }));
    await screen.findByText("✓ Preserved");
    const name = screen.getByRole("textbox", { name: "Relation name" });
    await user.clear(name);
    await user.type(name, "Updated");
    await user.click(screen.getByRole("button", { name: "Analyze again" }));
    await screen.findByRole("heading", { name: "Updated(A, B, C)" });
    expect(screen.queryByRole("heading", { name: "3NF synthesis" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "BCNF decomposition" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Dependency preservation" })).toBeNull();
    expect(screen.getByRole("button", { name: "Generate 3NF synthesis" })).toBeTruthy();
  });

  it("keeps BCNF results during loading and failure and reports preservation loading/error", async () => {
    const user = userEvent.setup();
    const bcnfRetry = deferred<BcnfDecompositionResponseDto>();
    const preservationPending = deferred<DependencyPreservationResponseDto>();
    let bcnfCalls = 0;
    const api = apiWith({
      decomposeBoyceCodd: vi.fn(async (input) => ++bcnfCalls === 1 ? bcnfFor(input) : bcnfRetry.promise),
      analyzeDependencyPreservation: vi.fn(() => preservationPending.promise),
    });
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate BCNF decomposition" }));
    await screen.findByRole("heading", { name: "BCNF decomposition" });
    await user.click(screen.getByRole("button", { name: "Generate BCNF decomposition again" }));
    expect(screen.getByText("Updating decomposition…")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "BCNF decomposition" })).toBeTruthy();
    bcnfRetry.reject(new SchemaWiseApiError({ kind: "unexpected", message: "stack" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Unable to generate BCNF decomposition.");
    expect(screen.getByRole("heading", { name: "BCNF decomposition" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Check dependency preservation" }));
    expect(screen.getByText("Checking dependency preservation…", { selector: ".transformation-live-status" })).toBeTruthy();
    preservationPending.reject(new SchemaWiseApiError({ kind: "api", code: "INCOMPLETE_DECOMPOSITION", message: "unsafe detail" }));
    await waitFor(() => expect(screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("Unable to check dependency preservation."))).toBe(true));
    expect(screen.queryByText("unsafe detail")).toBeNull();
  });

  it("aborts an older synthesis request and ignores its late failure", async () => {
    const user = userEvent.setup();
    let firstSignal: AbortSignal | undefined;
    let calls = 0;
    const api = apiWith({ synthesizeThirdNormalForm: vi.fn((input: SchemaInputDto, signal?: AbortSignal): Promise<ThirdNormalFormSynthesisResponseDto> => {
      calls += 1;
      if (calls === 2) return Promise.resolve(synthesisFor(input));
      firstSignal = signal;
      return new Promise<ThirdNormalFormSynthesisResponseDto>((_resolve, reject) => signal?.addEventListener("abort", () => reject(new SchemaWiseApiError({ kind: "aborted", message: "aborted" }))));
    }) });
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis" }));
    await user.click(screen.getByRole("button", { name: "Generating 3NF synthesis…" }));
    expect(firstSignal?.aborted).toBe(true);
    expect(api.synthesizeThirdNormalForm).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("heading", { name: "3NF synthesis" })).toBeTruthy();
    expect(screen.queryByText("Unable to generate 3NF synthesis.")).toBeNull();
  });
});
