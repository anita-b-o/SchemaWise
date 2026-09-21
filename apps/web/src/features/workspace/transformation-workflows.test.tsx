import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SchemaWiseApiError, type SchemaWiseApi } from "../../api/schemawise-api";
import type { AnalysisResponseDto, BcnfDecompositionResponseDto, DependencyPreservationRequestDto, DependencyPreservationResponseDto, SchemaInputDto, ThirdNormalFormSynthesisResponseDto } from "../../api/schemawise-contracts";
import { analyzeSchema, synthesizeThirdNormalForm, decomposeBoyceCodd, analyzeDependencyPreservationUseCase } from "../../../../api/src/application/use-cases";
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

function multiStepBcnfFor(input: SchemaInputDto): BcnfDecompositionResponseDto {
  const [a, b, c] = input.relation.attributes.map((attribute) => attribute.id) as [string, string, string];
  return {
    relations: [{ attributes: [b, c] }, { attributes: [a] }, { attributes: [b] }],
    steps: [
      { source: [a, b, c], violation: { determinant: [b], dependent: c }, result: [[b, c], [a, b]] },
      { source: [a, b], violation: { determinant: [a], dependent: b }, result: [[a, b], [a]] },
    ],
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
  await screen.findByRole("link", { name: "Explore transformations" });
  await user.click(screen.getByRole("link", { name: "Explore transformations" }));
  await screen.findByRole("heading", { name: "Transformations", level: 1 });
}

describe("normalization transformations", () => {
  it("renders the Enrollment 3/44/44 gate and exact 3NF, BCNF, and lost-dependency outcomes", async () => {
    const user = userEvent.setup();
    const enrollment: SchemaInputDto = {
      relation: { name: "Enrollment", attributes: [
        { id: "d", name: "Student" }, { id: "c", name: "Course" }, { id: "a", name: "Professor" },
        { id: "b", name: "Department" }, { id: "e", name: "Grade" }, { id: "f", name: "Office" },
      ] },
      functionalDependencies: [
        { left: ["d", "c"], right: ["e"] }, { left: ["c"], right: ["a"] },
        { left: ["a"], right: ["b"] }, { left: ["a"], right: ["f"] }, { left: ["b"], right: ["f"] },
      ],
    };
    const api = apiWith({
      analyzeSchema: vi.fn(async (input) => analyzeSchema(input)),
      synthesizeThirdNormalForm: vi.fn(async (input) => synthesizeThirdNormalForm(input)),
      decomposeBoyceCodd: vi.fn(async (input) => decomposeBoyceCodd(input)),
      analyzeDependencyPreservation: vi.fn(async (input) => analyzeDependencyPreservationUseCase(input)),
    });
    render(<SchemaWorkspace api={api} initialProject={{ id: "11111111-1111-4111-8111-111111111111", name: "Enrollment", revision: 1, schema: { schemaVersion: 1, ...enrollment }, createdAt: "2026-09-21T00:00:00Z", updatedAt: "2026-09-21T00:00:00Z" }} />);
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    await screen.findByRole("heading", { name: "Enrollment(Student, Course, Professor, Department, Grade, Office)" });
    expect([...document.querySelectorAll(".normal-form-count")].map((node) => node.textContent)).toEqual(["3 violations", "44 violations", "44 violations"]);
    await user.click(screen.getByRole("link", { name: "Explore transformations" }));
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis" }));
    const synthesis = await screen.findByRole("region", { name: "Synthesis result" });
    expect([...synthesis.querySelectorAll(".relation-result-list code")].map((node) => node.querySelector('[aria-hidden="true"]')?.textContent).sort()).toEqual([
      "{Professor, Department}", "{Course, Professor}", "{Department, Office}", "{Student, Course, Grade}",
    ].sort());
    await user.click(screen.getByRole("button", { name: "Generate BCNF decomposition" }));
    const bcnf = await screen.findByRole("region", { name: "Decomposition result" });
    expect([...bcnf.querySelectorAll(".final-relations code")].map((node) => node.querySelector('[aria-hidden="true"]')?.textContent).sort()).toEqual([
      "{Professor, Department}", "{Course, Professor}", "{Professor, Office}", "{Student, Course, Grade}",
    ].sort());
    expect(bcnf.querySelectorAll(".decomposition-steps > ol > li")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Check dependency preservation" }));
    expect(await screen.findByText("× Not preserved")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Preservation result" })).getByText("Department → Office")).toBeTruthy();
    expect(api.analyzeSchema).toHaveBeenCalledTimes(1);
    expect(api.synthesizeThirdNormalForm).toHaveBeenCalledTimes(1);
    expect(api.decomposeBoyceCodd).toHaveBeenCalledTimes(1);
    expect(api.analyzeDependencyPreservation).toHaveBeenCalledTimes(1);
  });

  it("keeps a stale snapshot without results readable and blocks every generation", async () => {
    const user = userEvent.setup();
    const api = apiWith();
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("link", { name: "Edit schema" }));
    await user.clear(screen.getByRole("textbox", { name: "Attribute 1 name" }));
    await user.type(screen.getByRole("textbox", { name: "Attribute 1 name" }), "Changed");
    await user.click(screen.getByRole("link", { name: "Transform" }));
    expect(screen.getByText("Out of date", { selector: ".stale-notice strong" })).toBeTruthy();
    expect(screen.getByText(/Analyze the updated schema before generating a transformation/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Generate (3NF|BCNF)/ })).toBeNull();
    expect(screen.getByRole("link", { name: "View analysis" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit schema" })).toBeTruthy();
    expect(api.synthesizeThirdNormalForm).not.toHaveBeenCalled();
    expect(api.decomposeBoyceCodd).not.toHaveBeenCalled();
  });

  it("compares both results without ranking them and distinguishes unchecked preservation", async () => {
    const user = userEvent.setup();
    render(<SchemaWorkspace api={apiWith()} />);
    await analyzeExample(user);
    expect(screen.queryByRole("heading", { name: "Compare the results" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis" }));
    await user.click(screen.getByRole("button", { name: "Generate BCNF decomposition" }));
    const comparison = screen.getByRole("heading", { name: "Compare the results" }).closest("section")!;
    expect(comparison.textContent).toContain("Dependency preserving");
    expect(comparison.textContent).toContain("Lossless join");
    expect(comparison.textContent).toContain("Not checked");
    expect(comparison.textContent).not.toContain("better");
    await user.click(screen.getByRole("button", { name: "Check dependency preservation" }));
    expect(comparison.textContent).toContain("Preserved");
    expect(comparison.textContent).not.toContain("Not checked");
  });

  it("retains a successful BCNF result when the first synthesis request fails", async () => {
    const user = userEvent.setup();
    const api = apiWith({ synthesizeThirdNormalForm: vi.fn(async () => { throw new SchemaWiseApiError({ kind: "network", message: "private detail" }); }) });
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate BCNF decomposition" }));
    await screen.findByRole("heading", { name: "Decomposition result" });
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Unable to generate 3NF synthesis.");
    expect(screen.getByRole("heading", { name: "Decomposition result" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check dependency preservation" })).toBeTruthy();
  });

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
    await user.click(screen.getByRole("link", { name: "Explore transformations" }));
    expect(screen.queryByRole("button", { name: /Generate 3NF synthesis/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Generate BCNF decomposition/ })).toBeNull();
    expect(screen.getByText("The relation already satisfies BCNF, so there is no decomposition to check.")).toBeTruthy();
  });

  it("uses the analyzed snapshot and renders synthesis sources, cover and guarantees", async () => {
    const user = userEvent.setup();
    const api = apiWith({ synthesizeThirdNormalForm: vi.fn(async (input) => synthesisFor(input, true)) });
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis" }));

    const request = vi.mocked(api.synthesizeThirdNormalForm).mock.calls[0]![0];
    expect(request.relation.name).toBe("R");
    const section = await screen.findByRole("region", { name: "Synthesis result" });
    expect(within(section).getAllByText("{A, B}").length).toBeGreaterThan(0);
    expect(within(section).getAllByText("{B, C}").length).toBeGreaterThan(0);
    expect(within(section).getAllByText(/Derived from minimal cover/)).toHaveLength(2);
    expect(within(section).getByText(/Added to contain a candidate key/)).toBeTruthy();
    expect(within(section).getByText("Additional candidate-key relation")).toBeTruthy();
    expect(within(section).getByText(/No synthesized relation contained a candidate key/)).toBeTruthy();
    expect(within(section).getByText(/Final relations are in 3NF by construction/)).toBeTruthy();
    expect(within(section).getByText(/Dependency preserving · Lossless join/)).toBeTruthy();
    expect(within(section).getByText("Explain synthesis").closest("details")?.open).toBe(false);
    expect(within(section).getByText("Formal reasoning").closest("details")?.open).toBe(false);
    expect(within(section).getByText("Minimal cover used").closest("details")?.open).toBe(false);
    expect(section.textContent).not.toContain("independently verified");
    expect(screen.getByText("3NF synthesis complete.", { selector: ".transformation-live-status" })).toBeTruthy();
  });

  it("does not render an empty candidate-key section when none was added", async () => {
    const user = userEvent.setup();
    render(<SchemaWorkspace api={apiWith()} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis" }));
    expect(screen.queryByText("Additional candidate-key relation")).toBeNull();
    const why = screen.getByText("Explain synthesis");
    await user.click(why);
    expect(screen.getByText("No additional candidate-key relation was required.")).toBeTruthy();
  });

  it("opens the generated transformation diagram directly and moves focus to it", async () => {
    const user = userEvent.setup();
    render(<SchemaWorkspace api={apiWith()} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis" }));
    const result = await screen.findByRole("region", { name: "Synthesis result" });
    await user.click(within(result).getByRole("button", { name: "View diagram" }));
    const diagram = await screen.findByRole("region", { name: "3NF synthesis diagram" });
    await waitFor(() => expect(document.activeElement).toBe(diagram));
    expect(screen.getByRole("link", { name: "Transform" }).getAttribute("aria-current")).toBe("page");
  });

  it("announces synthesis loading and retains its previous result after failure", async () => {
    const user = userEvent.setup();
    const retry = deferred<ThirdNormalFormSynthesisResponseDto>();
    let calls = 0;
    const api = apiWith({ synthesizeThirdNormalForm: vi.fn(async (input) => ++calls === 1 ? synthesisFor(input) : retry.promise) });
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate 3NF synthesis" }));
    await screen.findByRole("heading", { name: "Synthesis result" });
    await user.click(screen.getByRole("button", { name: "Run again: 3NF synthesis" }));
    expect(screen.getByText("Updating synthesis…")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Synthesis result" })).toBeTruthy();
    retry.reject(new SchemaWiseApiError({ kind: "network", message: "secret stack" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Unable to generate 3NF synthesis.");
    expect(alert.textContent).not.toContain("secret stack");
    expect(screen.getByRole("heading", { name: "Synthesis result" })).toBeTruthy();
  });

  it("renders BCNF leaves, formatted steps and distinct guarantees", async () => {
    const user = userEvent.setup();
    const api = apiWith();
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate BCNF decomposition" }));
    const section = await screen.findByRole("region", { name: "Decomposition result" });
    expect(within(section).getByText("Final relations")).toBeTruthy();
    expect(within(section).getAllByText("{B, C}").length).toBeGreaterThan(0);
    expect(within(section).getAllByText("Step 1").length).toBeGreaterThan(0);
    expect(within(section).getAllByText("R(A, B, C)").length).toBeGreaterThan(0);
    expect(within(section).getAllByText("B → C").length).toBeGreaterThan(0);
    expect(within(section).getByText("Every final relation satisfies BCNF. Each decomposition step is lossless by construction.")).toBeTruthy();
    expect(within(section).getByText("Dependency preservation is not guaranteed by BCNF decomposition.")).toBeTruthy();
    expect(within(section).getByText("Why was this relation split?", { exact: false }).closest("details")?.open).toBe(false);
    expect(within(section).getByText("Explain decomposition").closest("details")?.open).toBe(false);
    expect(screen.getByText("BCNF decomposition complete.", { selector: ".transformation-live-status" })).toBeTruthy();
  });

  it("explains a BCNF violation and its contractual lossless split without claiming preservation", async () => {
    const user = userEvent.setup();
    render(<SchemaWorkspace api={apiWith()} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate BCNF decomposition" }));
    const section = await screen.findByRole("region", { name: "Decomposition result" });
    await user.click(within(section).getByText(/View decomposition steps/));
    await user.click(within(section).getByText("Why was this relation split?", { exact: false }));
    expect(within(section).getByText(/violates BCNF because its determinant is not a superkey/)).toBeTruthy();
    const step = section.querySelector<HTMLElement>(".decomposition-steps > ol > li")!;
    await user.click(within(step).getByText("Formal reasoning"));
    expect(within(section).getByText(/relation one = X union Y; relation two = R minus/)).toBeTruthy();
    expect(within(section).getByText(/uses the violation determinant as the overlap condition/)).toBeTruthy();
    expect(section.textContent).not.toContain("guarantees dependency preservation");
    expect(section.textContent).not.toContain("ran a chase");
  });

  it("keeps multi-step BCNF decomposition in DTO order", async () => {
    const user = userEvent.setup();
    const api = apiWith({ decomposeBoyceCodd: vi.fn(async (input) => multiStepBcnfFor(input)) });
    render(<SchemaWorkspace api={api} />);
    await analyzeExample(user);
    await user.click(screen.getByRole("button", { name: "Generate BCNF decomposition" }));
    const section = await screen.findByRole("region", { name: "Decomposition result" });
    const steps = [...section.querySelectorAll<HTMLElement>(".decomposition-steps > ol > li")];
    expect(steps).toHaveLength(2);
    expect(steps[0]?.textContent).toContain("B → C");
    expect(steps[1]?.textContent).toContain("A → B");
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
    expect(screen.getByText("Observed / checked result")).toBeTruthy();
    await user.click(screen.getByText("Explain preservation"));
    expect(screen.getByText(/can be enforced using the decomposed relations without reconstructing/)).toBeTruthy();
    expect(screen.getByText("Dependency preservation check complete.", { selector: ".transformation-live-status" })).toBeTruthy();
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
    const heading = await screen.findByRole("heading", { name: "Preservation result" });
    const section = heading.closest("section")!;
    expect(within(section).getByText("× Not preserved")).toBeTruthy();
    expect(within(section).getByText("Lost dependencies")).toBeTruthy();
    expect(within(section).getByText("A, B → C")).toBeTruthy();
    expect(within(section).getByText(/not implied by the union of the projected dependencies/)).toBeTruthy();
    expect(within(section).getByText("Preserved dependencies").compareDocumentPosition(within(section).getByText("Lost dependencies")) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    await user.click(within(section).getByText("Explain preservation"));
    expect(within(section).getByText(/does not mean that data was lost/)).toBeTruthy();
    await user.click(within(section).getByText("Preserved dependencies"));
    expect(within(section).getByText(/may follow transitively from the combined projections/)).toBeTruthy();
    expect(section.textContent).not.toContain("appears directly in one final relation");
    await user.click(within(section).getByText("Formal reasoning"));
    expect(within(section).getByText(/Conceptually, dependency preservation is checked by projecting F onto each relation/)).toBeTruthy();
    expect(within(section).getByText(/not a request execution trace/)).toBeTruthy();
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
    await user.click(screen.getByRole("link", { name: "Edit schema" }));
    await user.clear(screen.getByRole("textbox", { name: "Attribute 1 name" }));
    await user.type(screen.getByRole("textbox", { name: "Attribute 1 name" }), "Changed");
    await user.click(screen.getByRole("link", { name: "Transform" }));

    expect(screen.getByText(/Analyze the updated schema before generating a transformation/)).toBeTruthy();
    for (const name of [/Run again: 3NF synthesis/, /Run again: BCNF decomposition/, /Check again: dependency preservation/]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByRole("heading", { name: "Synthesis result" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Decomposition result" })).toBeTruthy();
    expect(screen.getByText("✓ Preserved")).toBeTruthy();
    const bcnfSection = screen.getByRole("heading", { name: "Decomposition result" }).closest("section")!;
    expect(within(bcnfSection).getAllByText("R(A, B, C)").length).toBeGreaterThan(0);
    expect(bcnfSection.textContent).not.toContain("Changed");
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
    await user.click(screen.getByRole("link", { name: "Edit schema" }));
    const name = screen.getByRole("textbox", { name: "Relation name" });
    await user.clear(name);
    await user.type(name, "Updated");
    await user.click(screen.getByRole("button", { name: "Analyze again" }));
    await screen.findByRole("heading", { name: "Updated(A, B, C)" });
    await user.click(screen.getByRole("link", { name: "Explore transformations" }));
    expect(screen.queryByRole("heading", { name: "Synthesis result" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Decomposition result" })).toBeNull();
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
    await screen.findByRole("heading", { name: "Decomposition result" });
    await user.click(screen.getByRole("button", { name: "Run again: BCNF decomposition" }));
    expect(screen.getByText("Updating decomposition…")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Decomposition result" })).toBeTruthy();
    bcnfRetry.reject(new SchemaWiseApiError({ kind: "unexpected", message: "stack" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Unable to generate BCNF decomposition.");
    expect(screen.getByRole("heading", { name: "Decomposition result" })).toBeTruthy();
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
    expect(await screen.findByRole("heading", { name: "Synthesis result" })).toBeTruthy();
    expect(screen.queryByText("Unable to generate 3NF synthesis.")).toBeNull();
  });
});
