import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import type { AnalysisResponseDto, SchemaInputDto } from "../../api/schemawise-contracts";
import { CONCEPT_DEFINITIONS, CONCEPT_DEFINITIONS_BY_ID } from "../explanations/concept-definitions";
import { AnalysisResults } from "./components/AnalysisResults";
import { ConceptHelp } from "./components/ConceptHelp";

const snapshot: SchemaInputDto = {
  relation: { name: "R", attributes: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] },
  functionalDependencies: [{ left: ["a"], right: ["b"] }, { left: ["b"], right: ["c"] }],
};

const result: AnalysisResponseDto = {
  relation: snapshot.relation,
  candidateKeys: [["a"]],
  primeAttributes: ["a"],
  minimalCover: snapshot.functionalDependencies,
  normalForms: {
    second: { satisfied: true, violations: [] },
    third: { satisfied: false, violations: [{ determinant: ["b"], dependent: "c" }] },
    bcnf: { satisfied: false, violations: [{ determinant: ["b"], dependent: "c" }] },
  },
};

function renderResult(outOfDate = false) {
  return render(<AnalysisResults result={result} analyzedSnapshot={snapshot} outOfDate={outOfDate}
    synthesis={{ status: "idle" }} bcnf={{ status: "idle" }} preservation={{ status: "idle" }}
    onGenerateSynthesis={() => undefined} onGenerateBcnf={() => undefined} onCheckPreservation={() => undefined} />);
}

describe("concept definitions", () => {
  it("provides one complete, unique source of truth for the 16 v1.1 concepts", () => {
    expect(CONCEPT_DEFINITIONS).toHaveLength(16);
    expect(new Set(CONCEPT_DEFINITIONS.map(({ id }) => id)).size).toBe(16);
    expect(Object.keys(CONCEPT_DEFINITIONS_BY_ID)).toHaveLength(16);
    expect(CONCEPT_DEFINITIONS_BY_ID["candidate-key"].definition).toContain("minimal superkey");
    expect(CONCEPT_DEFINITIONS_BY_ID["primary-key"].definition).toContain("selected by database design");
    expect(CONCEPT_DEFINITIONS_BY_ID["transitive-dependency"].definition).toContain("intermediate determinant");
    expect(CONCEPT_DEFINITIONS_BY_ID["3nf"].definition).toContain("superkey or every dependent attribute is prime");
    expect(CONCEPT_DEFINITIONS_BY_ID.bcnf.optionalNote).toContain("no prime-attribute exception");
    expect(CONCEPT_DEFINITIONS_BY_ID["dependency-preservation"].optionalNote).toContain("lossless join is a separate property");
    expect(CONCEPT_DEFINITIONS_BY_ID["candidate-key"].definition).not.toEqual(CONCEPT_DEFINITIONS_BY_ID["primary-key"].definition);
  });
});

describe("contextual concept help", () => {
  it("has an accessible keyboard trigger and returns focus naturally when closed", async () => {
    const user = userEvent.setup();
    render(<ConceptHelp concept="candidate-key" label="What is a candidate key?" />);
    const trigger = screen.getByRole("button", { name: "What is a candidate key?" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("region", { name: "Candidate key definition" }).textContent).toContain("SchemaWise discovers candidate keys; it does not select a primary key.");
    expect(document.activeElement).toBe(trigger);
    await user.keyboard(" ");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("region", { name: "Candidate key definition" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps contextual help and the glossary closed by default", () => {
    const { container } = renderResult();
    expect(screen.queryByRole("region", { name: "Candidate key definition" })).toBeNull();
    expect(screen.getByText("Concept reference").closest("details")?.open).toBe(false);
    expect(container.querySelectorAll(".concept-reference__list > div")).toHaveLength(16);
  });

  it("opens the semantic glossary with all terms in a single mobile-safe DOM", async () => {
    const user = userEvent.setup();
    renderResult();
    const summary = screen.getByText("Concept reference").closest("summary")!;
    await user.click(summary);
    const glossary = summary.closest("section")!;
    expect(summary.closest("details")?.open).toBe(true);
    for (const { term } of CONCEPT_DEFINITIONS) expect(within(glossary).getByText(term, { selector: "dt" })).toBeTruthy();
    expect(within(glossary).getByText(/SchemaWise does not select a primary key/)).toBeTruthy();
    expect(glossary.querySelectorAll("dl > div")).toHaveLength(16);
  });

  it("does not call the network or transformation callbacks when education is opened", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const onSynthesis = vi.fn();
    const onBcnf = vi.fn();
    const onPreservation = vi.fn();
    render(<AnalysisResults result={result} analyzedSnapshot={snapshot} outOfDate={true}
      synthesis={{ status: "idle" }} bcnf={{ status: "idle" }} preservation={{ status: "idle" }}
      onGenerateSynthesis={onSynthesis} onGenerateBcnf={onBcnf} onCheckPreservation={onPreservation} />);
    await user.click(screen.getByRole("button", { name: "What is a candidate key?" }));
    await user.click(screen.getByText("Concept reference"));
    await user.click(screen.getByText("3NF violations"));
    await user.click(screen.getAllByText("Why?", { exact: false })[0]!);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onSynthesis).not.toHaveBeenCalled();
    expect(onBcnf).not.toHaveBeenCalled();
    expect(onPreservation).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Candidate key definition" }).textContent).toContain("SchemaWise discovers candidate keys");
    fetchSpy.mockRestore();
  });

  it("has no automated axe violations in the rendered educational surface", async () => {
    const { container } = renderResult();
    const report = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(report.violations).toEqual([]);
  });
});

describe("dense and long educational content", () => {
  it("keeps six-attribute keys, long names, repeated violations, BCNF steps and lost dependencies in one responsive DOM", () => {
    const longName = "Attribute".padEnd(120, "X");
    const attributes = Array.from({ length: 6 }, (_, index) => ({ id: `a${index}`, name: index === 0 ? longName : `Attribute${index + 1}` }));
    const ids = attributes.map(({ id }) => id);
    const denseSnapshot: SchemaInputDto = {
      relation: { name: "Relation".padEnd(120, "R"), attributes },
      functionalDependencies: [{ left: ids.slice(0, 4), right: ids.slice(4) }],
    };
    const violations = ids.slice(2, 6).map((dependent) => ({ determinant: [ids[0]!], dependent }));
    const denseResult: AnalysisResponseDto = {
      relation: denseSnapshot.relation,
      candidateKeys: [ids, ids.slice(0, 3)],
      primeAttributes: ids,
      minimalCover: denseSnapshot.functionalDependencies,
      normalForms: {
        second: { satisfied: false, violations: violations.map(({ determinant, dependent }) => ({ candidateKey: ids, determinant, dependent })) },
        third: { satisfied: false, violations },
        bcnf: { satisfied: false, violations },
      },
    };
    const { container } = render(<AnalysisResults result={denseResult} analyzedSnapshot={denseSnapshot} outOfDate={false}
      synthesis={{ status: "idle" }}
      bcnf={{ status: "success", data: { relations: [{ attributes: ids.slice(0, 3) }, { attributes: ids.slice(3) }], steps: [
        { source: ids, violation: violations[0]!, result: [ids.slice(0, 3), ids.slice(3)] },
        { source: ids.slice(0, 3), violation: violations[1]!, result: [ids.slice(0, 2), ids.slice(1, 3)] },
      ] } }}
      preservation={{ status: "success", data: { preserved: false, lostDependencies: denseSnapshot.functionalDependencies, preservedDependencies: [] } }}
      onGenerateSynthesis={() => undefined} onGenerateBcnf={() => undefined} onCheckPreservation={() => undefined} />);
    expect(screen.getByRole("heading", { name: new RegExp("^RelationR") }).textContent).toContain(longName);
    expect(container.querySelectorAll(".key-fact .notation-list code")).toHaveLength(2);
    expect(container.querySelectorAll(".violation-list > li")).toHaveLength(12);
    expect(container.querySelectorAll(".decomposition-steps > ol > li")).toHaveLength(2);
    expect(container.querySelectorAll(".dependency-evidence-list > li")).toHaveLength(1);
    expect(container.querySelectorAll(".analysis-results")).toHaveLength(1);
  });
});
