import axe from "axe-core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResponseDto, BcnfDecompositionResponseDto, DependencyPreservationResponseDto, SchemaInputDto, ThirdNormalFormSynthesisResponseDto } from "../../api/schemawise-contracts";
import { AnalysisResults } from "./components/AnalysisResults";
import { TransformSurface } from "./components/TransformSurface";
import { MemoryRouter } from "react-router-dom";

const analyzedSnapshot: SchemaInputDto = {
  relation: { name: "R", attributes: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] },
  functionalDependencies: [{ left: ["a", "b"], right: ["c"] }, { left: [], right: ["a"] }],
};

const result: AnalysisResponseDto = {
  relation: analyzedSnapshot.relation,
  candidateKeys: [["a", "b"], ["a", "c"]],
  primeAttributes: ["a", "b", "c"],
  minimalCover: [{ left: ["a", "b"], right: ["c"] }, { left: [], right: ["a"] }],
  normalForms: {
    second: { satisfied: false, violations: [{ candidateKey: ["a", "b"], determinant: ["a"], dependent: "c" }] },
    third: { satisfied: false, violations: [{ determinant: ["c"], dependent: "b" }] },
    bcnf: { satisfied: false, violations: [{ determinant: ["c"], dependent: "b" }] },
  },
};

const synthesis: ThirdNormalFormSynthesisResponseDto = {
  relations: [{ attributes: ["a", "b"], source: "minimal-cover" }, { attributes: ["a", "c"], source: "candidate-key" }],
  minimalCover: result.minimalCover,
  addedCandidateKey: ["a", "c"],
};

const bcnf: BcnfDecompositionResponseDto = {
  relations: [{ attributes: ["b", "c"] }, { attributes: ["a", "b"] }],
  steps: [
    { source: ["a", "b", "c"], violation: { determinant: ["c"], dependent: "b" }, result: [["b", "c"], ["a", "c"]] },
    { source: ["a", "c"], violation: { determinant: ["a"], dependent: "c" }, result: [["a", "c"], ["a"]] },
  ],
};

const preservation: DependencyPreservationResponseDto = {
  preserved: false,
  preservedDependencies: [],
  lostDependencies: [{ left: ["a", "b"], right: ["c"] }],
};

function view(options: { draftSnapshot?: SchemaInputDto; analyzed?: SchemaInputDto; value?: AnalysisResponseDto; outOfDate?: boolean } = {}) {
  const analysisSnapshot = options.analyzed ?? analyzedSnapshot;
  return render(
    <AnalysisResults
      result={options.value ?? result}
      draftSnapshot={options.draftSnapshot ?? analysisSnapshot}
      analyzedSnapshot={analysisSnapshot}
      outOfDate={options.outOfDate ?? false}
    />,
  );
}

async function openVisualization(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Diagram/ }));
  return document.querySelector<HTMLElement>(".schema-visualization__content")!;
}

function largeIssueCase() {
  const largeSnapshot: SchemaInputDto = {
    relation: { name: "LargeIssues", attributes: ["A", "B", "C", "D", "E", "F"].map((name) => ({ id: name.toLowerCase(), name })) },
    functionalDependencies: [{ left: ["a"], right: ["f"] }],
  };
  const pairs = Array.from({ length: 44 }, (_, index) => ({
    determinant: ["a", "b", "c", "d", "e"].filter((_, bit) => (index % 32 & (1 << bit)) !== 0),
    dependent: index < 32 ? "f" : "e",
  }));
  const largeResult: AnalysisResponseDto = {
    relation: largeSnapshot.relation,
    candidateKeys: [["a", "b"]],
    primeAttributes: ["a", "b"],
    minimalCover: largeSnapshot.functionalDependencies,
    normalForms: {
      second: { satisfied: false, violations: pairs.slice(0, 3).map(({ determinant, dependent }) => ({ candidateKey: ["a", "b"], determinant, dependent })) },
      third: { satisfied: false, violations: pairs },
      bcnf: { satisfied: false, violations: pairs },
    },
  };
  return { largeSnapshot, largeResult };
}

describe("schema visualization", () => {
  afterEach(() => vi.restoreAllMocks());

  it("discloses all 44 issues and restores the eight-issue summary by keyboard", async () => {
    const user = userEvent.setup();
    const { largeSnapshot, largeResult } = largeIssueCase();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    view({ analyzed: largeSnapshot, value: largeResult, outOfDate: true });
    const issues = screen.getByRole("heading", { name: "Issues" }).parentElement!.parentElement!;
    expect(issues.textContent).toContain("44 dependencies");
    expect(issues.querySelectorAll(".issue-list > li")).toHaveLength(8);
    expect(issues.textContent).toContain("includes dependencies implied by the entered functional dependencies");
    const counts = [...document.querySelectorAll(".normal-form-count")].map((node) => node.textContent);
    expect(counts).toEqual(["3 violations", "44 violations", "44 violations"]);

    const expand = within(issues).getByRole("button", { name: "Show all 44 issues" });
    expand.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(expand);
    expect(expand.getAttribute("aria-expanded")).toBe("true");
    expect(issues.querySelectorAll(".issue-list > li")).toHaveLength(44);

    const collapse = within(issues).getByRole("button", { name: "Show fewer issues" });
    collapse.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(collapse);
    expect(issues.querySelectorAll(".issue-list > li")).toHaveLength(8);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("explains a previously hidden issue and its formal reasoning", async () => {
    const user = userEvent.setup();
    const { largeSnapshot, largeResult } = largeIssueCase();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    view({ analyzed: largeSnapshot, value: largeResult, outOfDate: true });
    const issues = screen.getByRole("heading", { name: "Issues" }).parentElement!.parentElement!;
    await user.click(within(issues).getByRole("button", { name: "Show all 44 issues" }));
    expect(issues.querySelectorAll(".issue-list > li")).toHaveLength(44);
    const hiddenIssue = issues.querySelectorAll<HTMLElement>(".issue-list > li")[43]!;
    await user.click(within(hiddenIssue).getByText(/Explain issue/));
    await user.click(hiddenIssue.querySelector<HTMLElement>(".formal-reasoning-disclosure > summary")!);
    expect(hiddenIssue.textContent).toContain("For every non-trivial dependency");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps a hidden issue selected in the stale diagram after showing fewer issues without requests", async () => {
    const user = userEvent.setup();
    const { largeSnapshot, largeResult } = largeIssueCase();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    view({ analyzed: largeSnapshot, value: largeResult, outOfDate: true });
    const issues = screen.getByRole("heading", { name: "Issues" }).parentElement!.parentElement!;
    await user.click(within(issues).getByRole("button", { name: "Show all 44 issues" }));
    expect(issues.querySelectorAll(".issue-list > li")).toHaveLength(44);
    const hiddenIssue = issues.querySelectorAll<HTMLElement>(".issue-list > li")[43]!;
    await user.click(within(hiddenIssue).getByRole("button", { name: /Show in diagram/ }));
    const panel = document.querySelector<HTMLElement>(".schema-visualization__content")!;
    await waitFor(() => expect(document.activeElement).toBe(panel));
    expect(within(panel).getByRole("button", { name: "Analysis" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(panel).getByRole("button", { name: /^3NF:/, pressed: true })).toBeTruthy();
    expect(screen.getByText("Results are out of date")).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();

    await user.click(within(issues).getByRole("button", { name: "Show fewer issues" }));
    expect(issues.querySelectorAll(".issue-list > li")).toHaveLength(8);
    expect(within(panel).getByRole("button", { name: /^3NF:/, pressed: true })).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("has no automated axe violations with the large issue summary and selected diagram", async () => {
    const { largeSnapshot, largeResult } = largeIssueCase();
    const { container } = view({ analyzed: largeSnapshot, value: largeResult, outOfDate: true });
    const issues = screen.getByRole("heading", { name: "Issues" }).parentElement!.parentElement!;
    const visibleIssues = issues.querySelectorAll<HTMLElement>(".issue-list > li");
    expect(visibleIssues).toHaveLength(8);
    await userEvent.setup().click(within(visibleIssues[3]!).getByRole("button", { name: /Show in diagram/ }));
    expect(document.querySelector(".schema-visualization__content")).toBeTruthy();
    expect((await axe.run(container)).violations).toEqual([]);
  });

  it("gives the diagram an accessible name, textual equivalents and an explicit composite determinant", async () => {
    const user = userEvent.setup();
    view();
    const panel = await openVisualization(user);
    expect(within(panel).getByRole("region", { name: "Draft schema" })).toBeTruthy();
    expect(within(panel).getByText("{A, B}")).toBeTruthy();
    expect(within(panel).getByText("∅")).toBeTruthy();
    expect(within(panel).getByText(/A, B functionally determines C/)).toBeTruthy();
    expect(panel.textContent).not.toContain("{A} → {C}");
    expect(panel.textContent).not.toContain("{B} → {C}");
  });

  it("supports keyboard candidate-key selection and labels key, prime and relation evidence", async () => {
    const user = userEvent.setup();
    view();
    const panel = await openVisualization(user);
    await user.click(within(panel).getByRole("button", { name: "Analysis" }));
    const key = within(panel).getByRole("button", { name: "Candidate key {A, B}" });
    key.focus();
    await user.keyboard("{Enter}");
    expect(key.getAttribute("aria-pressed")).toBe("true");
    expect(within(panel).getAllByText(/Key · Prime|Prime · Key/).length).toBeGreaterThan(0);
    expect(within(panel).getByLabelText("Diagram legend").textContent).toContain("Prime attribute");
    expect(within(panel).getByLabelText("Relation R")).toBeTruthy();
  });

  it("synchronizes a textual 2NF selection with exact diagram evidence", async () => {
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole("button", { name: /Show in diagram: A → C/ }));
    const panel = document.querySelector<HTMLElement>(".schema-visualization__content")!;
    expect(within(panel).getByRole("button", { name: "Analysis" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(panel).getByRole("button", { name: "2NF: A → C" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(panel).getByText(/candidate key \{A, B\}; partial determinant \{A\}; dependent non-prime attribute C/)).toBeTruthy();
    expect(within(panel).getByText("Key · Determinant · Prime")).toBeTruthy();
    expect(within(panel).getByText("Key · Prime")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Selected in diagram: A → C/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps draft and historical analysis names separate when stale", async () => {
    const user = userEvent.setup();
    const draft: SchemaInputDto = {
      relation: { name: "DraftR", attributes: [{ id: "a", name: "Renamed A" }, { id: "b", name: "B" }] },
      functionalDependencies: [{ left: ["a"], right: ["b"] }],
    };
    view({ draftSnapshot: draft, outOfDate: true });
    const panel = await openVisualization(user);
    expect(within(panel).getByText("Renamed A")).toBeTruthy();
    await user.click(within(panel).getByRole("button", { name: "Analysis" }));
    expect(within(panel).getByText("A")).toBeTruthy();
    expect(within(panel).queryByText("Renamed A")).toBeNull();
    expect(within(panel).getByText(/remains tied to R\(A, B, C\)/)).toBeTruthy();
  });

  it("renders transformation diagrams on Transform as fan-out, ordered splits and lost dependencies", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><TransformSurface analysis={result} snapshot={analyzedSnapshot} outOfDate={false}
      synthesis={{ status: "success", data: synthesis }} bcnf={{ status: "success", data: bcnf }} preservation={{ status: "success", data: preservation }}
      analysisHref="/?view=analysis" schemaHref="/" onNavigate={() => undefined} onGenerateSynthesis={() => undefined} onGenerateBcnf={() => undefined} onCheckPreservation={() => undefined} headingRef={() => undefined} /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: /Transformation diagrams/ }));
    const panel = document.querySelector<HTMLElement>(".transform-visualization .schema-visualization__content")!;
    expect(within(panel).getByRole("region", { name: "3NF synthesis diagram" })).toBeTruthy();
    expect(within(panel).getByText("One synthesis operation produces a set of relations; this is not a decomposition tree.")).toBeTruthy();
    const bcnfDiagram = within(panel).getByRole("region", { name: "BCNF decomposition diagram" });
    const stepTwo = within(bcnfDiagram).getByRole("button", { name: /Step 2:/ });
    await user.click(stepTwo);
    expect(stepTwo.getAttribute("aria-pressed")).toBe("true");
    expect(within(panel).getByText("× Not preserved")).toBeTruthy();
    expect(within(panel).getByText("Lost dependency")).toBeTruthy();
    expect(within(panel).getByText(/does not identify a single responsible leaf relation/)).toBeTruthy();
    expect(within(panel).getByText(/Lost dependency does not mean lost data/)).toBeTruthy();
  });

  it("keeps Analysis diagrams separate and has no automated axe violations", async () => {
    const user = userEvent.setup();
    const { container } = view();
    const panel = await openVisualization(user);
    expect(within(panel).queryByRole("button", { name: "Transformations" })).toBeNull();
    const report = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(report.violations).toEqual([]);
  });

  it("keeps a 120-character attribute label complete and available without hover", async () => {
    const user = userEvent.setup();
    const longLabel = "customer_account_identifier_".repeat(5).slice(0, 120);
    const longSnapshot: SchemaInputDto = {
      relation: { name: "LongLabels", attributes: [{ id: "a", name: longLabel }] },
      functionalDependencies: [],
    };
    const longResult: AnalysisResponseDto = {
      relation: longSnapshot.relation,
      candidateKeys: [["a"]],
      primeAttributes: ["a"],
      minimalCover: [],
      normalForms: {
        second: { satisfied: true, violations: [] },
        third: { satisfied: true, violations: [] },
        bcnf: { satisfied: true, violations: [] },
      },
    };
    view({ analyzed: longSnapshot, value: longResult });
    const panel = await openVisualization(user);
    const label = within(panel).getByText(longLabel);
    expect(label.textContent).toBe(longLabel);
    expect(label.closest("li")?.getAttribute("title")).toBe(longLabel);
  });

  it("explains empty relation, dependency and violation states instead of showing a blank canvas", async () => {
    const user = userEvent.setup();
    const emptySnapshot: SchemaInputDto = { relation: { name: "Empty", attributes: [] }, functionalDependencies: [] };
    const emptyResult: AnalysisResponseDto = {
      relation: emptySnapshot.relation,
      candidateKeys: [],
      primeAttributes: [],
      minimalCover: [],
      normalForms: {
        second: { satisfied: true, violations: [] },
        third: { satisfied: true, violations: [] },
        bcnf: { satisfied: true, violations: [] },
      },
    };
    view({ analyzed: emptySnapshot, value: emptyResult });
    const panel = await openVisualization(user);
    expect(within(panel).getByText("No attributes in this relation.")).toBeTruthy();
    expect(within(panel).getByText("No functional dependencies to display.")).toBeTruthy();
    await user.click(within(panel).getByRole("button", { name: "Analysis" }));
    expect(within(panel).getByText("No violations returned")).toBeTruthy();
  });
});
