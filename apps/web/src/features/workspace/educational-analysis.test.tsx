import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { AnalysisResponseDto, SchemaInputDto } from "../../api/schemawise-contracts";
import { buildCandidateKeyExplanation, buildClosureExplanation, buildMinimalCoverExplanation, buildPrimeAttributeExplanation } from "../explanations/explanation-builders";
import { AnalysisResults } from "./components/AnalysisResults";
import { MathematicalNotation } from "./components/MathematicalNotation";

const snapshot: SchemaInputDto = {
  relation: { name: "R", attributes: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] },
  functionalDependencies: [{ left: ["a"], right: ["b"] }, { left: ["b"], right: ["c"] }],
};

function result(overrides: Partial<AnalysisResponseDto> = {}): AnalysisResponseDto {
  return {
    relation: snapshot.relation,
    candidateKeys: [["a"]],
    primeAttributes: ["a"],
    minimalCover: [{ left: ["a"], right: ["b"] }, { left: ["b"], right: ["c"] }],
    normalForms: {
      second: { satisfied: true, violations: [] },
      third: { satisfied: true, violations: [] },
      bcnf: { satisfied: true, violations: [] },
    },
    ...overrides,
  };
}

function renderResult(value: AnalysisResponseDto = result()) {
  return render(
    <AnalysisResults
      result={value}
      analyzedSnapshot={snapshot}
      outOfDate={false}
      synthesis={{ status: "idle" }}
      bcnf={{ status: "idle" }}
      preservation={{ status: "idle" }}
      onGenerateSynthesis={() => undefined}
      onGenerateBcnf={() => undefined}
      onCheckPreservation={() => undefined}
    />,
  );
}

function sectionFor(heading: string): HTMLElement {
  const element = screen.getByRole("heading", { name: heading }).parentElement;
  if (!element) throw new Error(`${heading} section was not found`);
  return element;
}

describe("educational content foundations", () => {
  it("records DTO, snapshot and operation-contract provenance without exposing jargon", () => {
    const candidate = buildCandidateKeyExplanation(["a"], 1, snapshot);
    expect(candidate.formal?.evidence.map((fact) => fact.source)).toEqual(["dto", "snapshot", "operation-contract"]);
    expect(buildPrimeAttributeExplanation("a", [["a"], ["a", "b"]]).formal?.evidence.map((fact) => fact.source)).toEqual(["dto", "snapshot"]);
    expect(buildMinimalCoverExplanation([{ left: ["a"], right: ["b"] }]).formal?.evidence.map((fact) => fact.source)).toContain("operation-contract");
  });

  it("keeps builders presentation-only and does not include a computed provenance source", () => {
    const serialized = JSON.stringify([
      buildCandidateKeyExplanation(["a"], 1, snapshot),
      buildPrimeAttributeExplanation("a", [["a"]]),
      buildMinimalCoverExplanation([]),
    ]);
    expect(serialized).not.toContain('"source":"computed"');
    expect(serialized).not.toContain("closure");
  });

  it("derives closure coverage only from the response and its immutable snapshot", () => {
    const complete = buildClosureExplanation(["a"], { closure: ["c", "a", "b"] }, snapshot);
    expect(complete.determined).toEqual(["a", "b", "c"]);
    expect(complete.missing).toEqual([]);
    expect(complete.determinesAllAttributes).toBe(true);
    expect(complete.educational.formal?.evidence.map((fact) => fact.source)).toEqual(["snapshot", "dto", "dto+snapshot"]);

    const partial = buildClosureExplanation(["a"], { closure: ["a", "b"] }, snapshot);
    expect(partial.determined).toEqual(["a", "b"]);
    expect(partial.missing).toEqual(["c"]);
    expect(partial.determinesAllAttributes).toBe(false);
  });

  it("supports empty-set closures without inferring candidate-key minimality", () => {
    const emptySnapshot: SchemaInputDto = {
      relation: { name: "R", attributes: [{ id: "a", name: "A" }, { id: "b", name: "B" }] },
      functionalDependencies: [{ left: [], right: ["a"] }, { left: ["a"], right: ["b"] }],
    };
    const complete = buildClosureExplanation([], { closure: ["a", "b"] }, emptySnapshot);
    const empty = buildClosureExplanation([], { closure: [] }, emptySnapshot);
    expect(complete.determinesAllAttributes).toBe(true);
    expect(empty.determinesAllAttributes).toBe(false);
    expect(JSON.stringify([complete, empty])).not.toMatch(/empty set is a candidate key/i);
  });
});

describe("candidate key education", () => {
  it.each([
    { name: "single", keys: [["a"]], expected: "{A}" },
    { name: "composite", keys: [["a", "b"]], expected: "{A, B}" },
    { name: "multiple", keys: [["a"], ["b", "c"]], expected: "{B, C}" },
  ])("explains a $name candidate key from the returned keys", async ({ name, keys, expected }) => {
    const user = userEvent.setup();
    renderResult(result({ candidateKeys: keys }));
    const section = sectionFor("Candidate keys");
    expect(section.querySelector(".notation-list")?.textContent).toContain(expected);
    await user.click(within(section).getByText(/^Why /));
    expect(within(section).getAllByText(/A candidate key is a minimal set of attributes/).length).toBeGreaterThan(0);
    if (name === "composite") expect(section.textContent).toContain("composite candidate key");
    if (name === "multiple") expect(section.textContent).toContain("A relation can have multiple candidate keys");
  });

  it("distinguishes an empty candidate key from an empty key list", () => {
    const { rerender } = renderResult(result({ candidateKeys: [[]], primeAttributes: [] }));
    let section = sectionFor("Candidate keys");
    expect(section.querySelector(".notation-list")?.textContent).toContain("∅");
    expect(section.textContent).toContain("empty-set candidate key");

    rerender(
      <AnalysisResults result={result({ candidateKeys: [], primeAttributes: [] })} analyzedSnapshot={snapshot} outOfDate={false}
        synthesis={{ status: "idle" }} bcnf={{ status: "idle" }} preservation={{ status: "idle" }}
        onGenerateSynthesis={() => undefined} onGenerateBcnf={() => undefined} onCheckPreservation={() => undefined} />,
    );
    section = sectionFor("Candidate keys");
    expect(section.textContent).toContain("No candidate keys were returned");
    expect(section.querySelector(".notation-list")).toBeNull();
  });

  it("states that candidate key is not primary key and keeps formal reasoning closed", () => {
    renderResult();
    const section = sectionFor("Candidate keys");
    const formal = within(section).getByText("Formal reasoning").closest("details");
    expect(formal?.open).toBe(false);
    expect(formal?.textContent).toContain("candidate key, not a selected primary key");
  });
});

describe("prime attribute education", () => {
  it("maps each prime attribute to one or multiple returned candidate keys", () => {
    renderResult(result({ candidateKeys: [["a", "b"], ["a", "c"]], primeAttributes: ["a", "b", "c"] }));
    const section = sectionFor("Prime attributes");
    const explanations = section.querySelectorAll(".educational-explanation");
    expect(explanations[0]?.textContent).toContain("is prime because it appears in candidate keys");
    expect([...explanations[0]!.querySelectorAll("[aria-hidden]")].map((node) => node.textContent)).toEqual(expect.arrayContaining(["A", "{A, B}", "{A, C}"]));
    expect(explanations[1]?.textContent).toContain("is prime because it appears in candidate key");
    expect([...explanations[1]!.querySelectorAll("[aria-hidden]")].map((node) => node.textContent)).toContain("{A, B}");
  });

  it("explains the empty set and preserves prime-versus-primary terminology", () => {
    renderResult(result({ candidateKeys: [[]], primeAttributes: [] }));
    const section = sectionFor("Prime attributes");
    expect(section.querySelector(":scope > code")?.textContent).toContain("∅");
    expect(section.textContent).toContain("No candidate key in this result contains an attribute");
    expect(section.textContent).toContain("Prime attribute does not mean primary-key attribute");
  });
});

describe("minimal cover education", () => {
  it("states only the operation-contract properties and does not invent a trace", () => {
    renderResult();
    const section = screen.getByRole("heading", { name: "Minimal cover" }).closest("section")!;
    expect(section.textContent).toContain("equivalent to the original set of functional dependencies");
    expect(section.textContent).toContain("Every right-hand side contains a single attribute");
    expect(section.textContent).toContain("No left-hand-side attribute is extraneous");
    expect(section.textContent).toContain("No functional dependency is redundant");
    expect(section.textContent).not.toMatch(/First SchemaWise|SchemaWise removed|then removed/i);
    expect(within(section).getByText("Formal reasoning").closest("details")?.open).toBe(false);
  });

  it("renders an empty cover and empty determinant without conflating them", () => {
    const { rerender } = renderResult(result({ minimalCover: [] }));
    let section = screen.getByRole("heading", { name: "Minimal cover" }).closest("section")!;
    expect(section.querySelector(":scope > code")?.textContent).toContain("∅");
    expect(section.textContent).toContain("no non-trivial dependencies remain");

    rerender(
      <AnalysisResults result={result({ minimalCover: [{ left: [], right: ["a"] }] })} analyzedSnapshot={snapshot} outOfDate={false}
        synthesis={{ status: "idle" }} bcnf={{ status: "idle" }} preservation={{ status: "idle" }}
        onGenerateSynthesis={() => undefined} onGenerateBcnf={() => undefined} onCheckPreservation={() => undefined} />,
    );
    section = screen.getByRole("heading", { name: "Minimal cover" }).closest("section")!;
    expect(section.querySelector(".notation-list")?.textContent).toContain("∅ → A");
    expect(section.textContent).toContain("functional dependency: the empty set determines A");
  });
});

describe("accessible progressive disclosure and notation", () => {
  it("uses a keyboard-focusable native summary and leaves nested formal reasoning closed", async () => {
    const user = userEvent.setup();
    renderResult();
    const why = screen.getByText("Why is this a candidate key?");
    expect(why.tagName).toBe("SUMMARY");
    expect(why.tabIndex).toBe(0);
    await user.tab();
    expect(document.activeElement).toBe(why);
    await user.click(why);
    expect(why.closest("details")?.open).toBe(true);
    expect(within(sectionFor("Candidate keys")).getByText("Formal reasoning").closest("details")?.open).toBe(false);
  });

  it("gives empty sets, closures, dependencies, attribute sets and relations understandable spoken text", () => {
    const lookup = new Map([["a", "A"], ["b", "B"]]);
    const { container } = render(<div>
      <MathematicalNotation value={{ kind: "attribute-set", ids: [] }} lookup={lookup} />
      <MathematicalNotation value={{ kind: "attribute-set", ids: ["a", "b"] }} lookup={lookup} />
      <MathematicalNotation value={{ kind: "closure", ids: ["a"] }} lookup={lookup} />
      <MathematicalNotation value={{ kind: "closure-result", selectedIds: ["a"], closureIds: ["a", "b"] }} lookup={lookup} />
      <MathematicalNotation value={{ kind: "functional-dependency", dependency: { left: ["a"], right: [] } }} lookup={lookup} />
      <MathematicalNotation value={{ kind: "relation", snapshot }} lookup={lookup} />
    </div>);
    expect(container.textContent).toContain("empty set");
    expect(container.textContent).toContain("set containing A and B");
    expect(container.textContent).toContain("closure of A");
    expect(container.textContent).toContain("closure of A equals set containing A and B");
    expect(container.textContent).toContain("functional dependency: A determines the empty set");
    expect(container.textContent).toContain("relation R with attributes A, B and C");
    expect(container.querySelectorAll("[aria-label]")).toHaveLength(0);
  });

  it("keeps result headings and essential Level 1 values outside disclosures", () => {
    renderResult();
    for (const heading of ["Candidate keys", "Prime attributes", "Normal forms", "Minimal cover"]) expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    expect(sectionFor("Candidate keys").querySelector(".notation-list")?.closest("details")).toBeNull();
    expect(sectionFor("Prime attributes").querySelector(":scope > code")?.closest("details")).toBeNull();
  });
});
