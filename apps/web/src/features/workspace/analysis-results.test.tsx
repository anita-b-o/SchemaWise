import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SchemaWiseApiError, type SchemaWiseApi } from "../../api/schemawise-api";
import type { AnalysisResponseDto, SchemaAnalysisRequestDto } from "../../api/schemawise-contracts";
import { SchemaWorkspace } from "./components/SchemaWorkspace";

function analysisFor(input: SchemaAnalysisRequestDto, empty = false): AnalysisResponseDto {
  const [a, b, c] = input.relation.attributes.map((attribute) => attribute.id);
  if (!a || !b || !c) throw new Error("The analysis fixture requires three attributes");
  return {
    relation: input.relation,
    candidateKeys: empty ? [[]] : [[a], [b, c]],
    primeAttributes: empty ? [] : [a, b],
    minimalCover: empty ? [] : [{ left: [a], right: [b] }, { left: [b], right: [c] }],
    normalForms: {
      second: { satisfied: false, violations: [{ candidateKey: [a, b], determinant: [a], dependent: c }] },
      third: { satisfied: false, violations: [{ determinant: [b], dependent: c }] },
      bcnf: { satisfied: false, violations: [{ determinant: [b], dependent: c }] },
    },
  };
}

function apiWith(analyzeSchema: SchemaWiseApi["analyzeSchema"]): SchemaWiseApi {
  return {
    analyzeSchema: vi.fn(analyzeSchema),
    calculateClosure: vi.fn(),
    synthesizeThirdNormalForm: vi.fn(),
    decomposeBoyceCodd: vi.fn(),
    analyzeDependencyPreservation: vi.fn(),
  };
}

async function loadExample(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Load example" }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("schema analysis interactions", () => {
  it("submits a valid snapshot once and renders the ordered analysis content", async () => {
    const user = userEvent.setup();
    const api = apiWith(async (input) => analysisFor(input));
    render(<SchemaWorkspace api={api} />);
    await loadExample(user);
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));

    expect(api.analyzeSchema).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: "R(A, B, C)" })).toBeTruthy();
    const candidateKeys = screen.getByRole("heading", { name: "Candidate keys" }).parentElement?.querySelector(".notation-list");
    if (!candidateKeys) throw new Error("Candidate key results were not found");
    expect(within(candidateKeys as HTMLElement).getByText("{A}")).toBeTruthy();
    expect(within(candidateKeys as HTMLElement).getByText("{B, C}")).toBeTruthy();
    const primeAttributes = screen.getByRole("heading", { name: "Prime attributes" }).parentElement;
    if (!primeAttributes) throw new Error("Prime attribute results were not found");
    expect(primeAttributes.querySelector(":scope > code")?.textContent).toContain("{A, B}");
    const minimalCover = screen.getByRole("heading", { name: "Minimal cover" }).closest("section");
    if (!minimalCover) throw new Error("Minimal cover section was not found");
    expect(within(minimalCover).getByText("A → B")).toBeTruthy();
    expect(within(minimalCover).getByText("B → C")).toBeTruthy();
    expect(screen.getAllByText("Violated")).toHaveLength(3);
    expect(screen.getByText("SchemaWise analyzes 2NF, 3NF and BCNF assuming the relation is already in 1NF.")).toBeTruthy();
    expect(screen.queryByText("1NF ✓")).toBeNull();

    const order = ["Candidate keys", "Prime attributes", "Normal forms", "Minimal cover", "Violation details"].map((name) => screen.getByRole("heading", { name }));
    for (let index = 1; index < order.length; index += 1) expect(order[index - 1]!.compareDocumentPosition(order[index]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps invalid drafts local and exposes a truly disabled action", async () => {
    const user = userEvent.setup();
    const api = apiWith(async (input) => analysisFor(input));
    render(<SchemaWorkspace api={api} />);
    const button = screen.getByRole("button", { name: "Analyze schema" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("Relation name is required.")).toBeTruthy();
    await user.click(button);
    expect(api.analyzeSchema).not.toHaveBeenCalled();
    expect(screen.queryByText("Analysis failed")).toBeNull();
  });

  it("announces a first analysis loading state without blocking the editor", async () => {
    const user = userEvent.setup();
    const pending = deferred<AnalysisResponseDto>();
    const api = apiWith(() => pending.promise);
    render(<SchemaWorkspace api={api} />);
    await loadExample(user);
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    expect((screen.getByRole("button", { name: "Analyzing…" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("status").textContent).toContain("Analyzing schema");
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).disabled).toBe(false);
  });

  it("renders empty candidate keys, prime attributes and minimal covers as the empty set", async () => {
    const user = userEvent.setup();
    const api = apiWith(async (input) => analysisFor(input, true));
    render(<SchemaWorkspace api={api} />);
    await loadExample(user);
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    await screen.findByRole("heading", { name: "R(A, B, C)" });
    const levelOneEmptySets = document.querySelectorAll(".key-fact > code .mathematical-notation, .key-fact > code > [aria-hidden], #minimal-cover-heading + code > [aria-hidden]");
    expect([...levelOneEmptySets].filter((element) => element.textContent === "∅")).toHaveLength(2);
    const candidateKeyList = screen.getByRole("heading", { name: "Candidate keys" }).parentElement?.querySelector(".notation-list");
    expect(candidateKeyList?.textContent).toContain("∅");
  });

  it("uses the analyzed snapshot for labels and marks edits out of date", async () => {
    const user = userEvent.setup();
    const api = apiWith(async (input) => analysisFor(input));
    render(<SchemaWorkspace api={api} />);
    await loadExample(user);
    const first = screen.getByRole("textbox", { name: "Attribute 1 name" });
    await user.clear(first);
    await user.type(first, "Customer");
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    await screen.findByRole("heading", { name: "R(Customer, B, C)" });
    await user.clear(first);
    await user.type(first, "Client");
    expect(screen.getByText("Results are out of date")).toBeTruthy();
    expect(screen.getByText("The schema has changed since this analysis. Analyze again to update the results.")).toBeTruthy();
    const results = screen.getByRole("heading", { name: "R(Customer, B, C)" }).closest("article");
    if (!results) throw new Error("Analysis results were not found");
    expect(results.querySelector(".notation-list")?.textContent).toContain("{Customer}");
    expect(within(results).queryByText("{Client}")).toBeNull();
    const candidateSection = within(results).getByRole("heading", { name: "Candidate keys" }).parentElement;
    if (!candidateSection) throw new Error("Candidate key section was not found");
    await user.click(within(candidateSection).getByText(/^Why /));
    expect([...candidateSection.querySelectorAll(".educational-disclosure [aria-hidden]")].map((node) => node.textContent)).toContain("{Customer}");
    expect(candidateSection.textContent).not.toContain("Client");
    expect(screen.getByRole("button", { name: "Analyze again" })).toBeTruthy();
  });

  it("re-analysis keeps previous results visible, then replaces their snapshot", async () => {
    const user = userEvent.setup();
    const second = deferred<AnalysisResponseDto>();
    let call = 0;
    const api = apiWith(async (input) => ++call === 1 ? analysisFor(input) : second.promise);
    render(<SchemaWorkspace api={api} />);
    await loadExample(user);
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    await screen.findByRole("heading", { name: "R(A, B, C)" });
    const first = screen.getByRole("textbox", { name: "Attribute 1 name" });
    await user.clear(first);
    await user.type(first, "Client");
    await user.click(screen.getByRole("button", { name: "Analyze again" }));
    expect(screen.getByText("Updating analysis…")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "R(A, B, C)" })).toBeTruthy();
    const input = vi.mocked(api.analyzeSchema).mock.calls[1]![0];
    second.resolve(analysisFor(input));
    expect(await screen.findByRole("heading", { name: "R(Client, B, C)" })).toBeTruthy();
    expect(screen.queryByText("Results are out of date")).toBeNull();
  });

  it("retains a previous result when re-analysis fails", async () => {
    const user = userEvent.setup();
    let call = 0;
    const api = apiWith(async (input) => {
      if (++call === 1) return analysisFor(input);
      throw new SchemaWiseApiError({ kind: "network", message: "socket stack secret" });
    });
    render(<SchemaWorkspace api={api} />);
    await loadExample(user);
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    await screen.findByRole("heading", { name: "R(A, B, C)" });
    await user.clear(screen.getByRole("textbox", { name: "Relation name" }));
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), "Changed");
    await user.click(screen.getByRole("button", { name: "Analyze again" }));
    expect(await screen.findByText("Analysis failed")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "R(A, B, C)" })).toBeTruthy();
    expect(screen.getByText("Results are out of date")).toBeTruthy();
    expect(screen.getByText("We couldn't reach SchemaWise. Check your connection and try again.")).toBeTruthy();
    expect(screen.queryByText(/socket stack secret/)).toBeNull();
  });

  it("maps contractual failures to user-facing copy while retaining the code", async () => {
    const user = userEvent.setup();
    const api = apiWith(async () => { throw new SchemaWiseApiError({ kind: "api", code: "ANALYSIS_LIMIT_EXCEEDED", message: "technical", status: 422 }); });
    render(<SchemaWorkspace api={api} />);
    await loadExample(user);
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This schema is too large to analyze within the current limits.");
    expect(alert.textContent).toContain("Error code: ANALYSIS_LIMIT_EXCEEDED");
    expect(alert.textContent).not.toContain("technical");
  });

  it("presents distinct 2NF, 3NF and BCNF evidence through semantic disclosures", async () => {
    const user = userEvent.setup();
    const api = apiWith(async (input) => analysisFor(input));
    render(<SchemaWorkspace api={api} />);
    await loadExample(user);
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    await screen.findByRole("heading", { name: "Violation details" });
    expect(screen.getByText("Candidate key: {A, B}")).toBeTruthy();
    expect(screen.getByText("Partial determinant: {A}")).toBeTruthy();
    expect(screen.getByText("Dependent non-prime attribute: C")).toBeTruthy();
    expect(screen.getAllByText("B is not a superkey.")).toHaveLength(2);
    expect(screen.getByText("C is not a prime attribute.")).toBeTruthy();
    expect(screen.getByText("Therefore this dependency violates 3NF.")).toBeTruthy();
    expect(screen.getByText("Therefore this dependency violates BCNF.")).toBeTruthy();
    for (const name of ["2NF violations", "3NF violations", "BCNF violations"]) expect(screen.getByText(name).closest("details")).toBeTruthy();
  });

  it("aborts an active request on unmount without exposing an error", async () => {
    const user = userEvent.setup();
    let capturedSignal: AbortSignal | undefined;
    const api = apiWith((_input, signal) => {
      capturedSignal = signal;
      return new Promise(() => undefined);
    });
    const view = render(<SchemaWorkspace api={api} />);
    await loadExample(user);
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    expect(capturedSignal?.aborted).toBe(false);
    view.unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("aborts an active request when a newer analysis starts and ignores the abort as an error", async () => {
    const user = userEvent.setup();
    let firstSignal: AbortSignal | undefined;
    let call = 0;
    const api = apiWith((input, signal) => {
      call += 1;
      if (call === 2) return Promise.resolve(analysisFor(input));
      firstSignal = signal;
      return new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(new SchemaWiseApiError({ kind: "aborted", message: "Request aborted" }))));
    });
    render(<SchemaWorkspace api={api} />);
    await loadExample(user);
    await user.click(screen.getByRole("button", { name: "Analyze schema" }));
    await user.click(screen.getByRole("button", { name: "Analyzing…" }));
    expect(firstSignal?.aborted).toBe(true);
    expect(api.analyzeSchema).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("heading", { name: "R(A, B, C)" })).toBeTruthy();
    expect(screen.queryByText("Analysis failed")).toBeNull();
  });

  it("keeps editor before results in DOM order for responsive reading", () => {
    const api = apiWith(async (input) => analysisFor(input));
    const { container } = render(<SchemaWorkspace api={api} />);
    const editor = container.querySelector(".schema-editor")!;
    const results = container.querySelector(".results-region")!;
    expect(editor.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
