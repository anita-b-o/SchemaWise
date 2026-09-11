import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { AnalysisResponseDto, SchemaInputDto } from "../../api/schemawise-contracts";
import { AnalysisResults } from "./components/AnalysisResults";

const snapshot: SchemaInputDto = {
  relation: { name: "R", attributes: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] },
  functionalDependencies: [{ left: ["a"], right: ["b"] }, { left: ["b"], right: ["c"] }],
};

function result(overrides: Partial<AnalysisResponseDto>): AnalysisResponseDto {
  return {
    relation: snapshot.relation,
    candidateKeys: [["a"]],
    primeAttributes: ["a"],
    minimalCover: [],
    normalForms: {
      second: { satisfied: true, violations: [] },
      third: { satisfied: true, violations: [] },
      bcnf: { satisfied: true, violations: [] },
    },
    ...overrides,
  };
}

function view(value: AnalysisResponseDto, analyzedSnapshot = snapshot, outOfDate = false) {
  return render(<AnalysisResults result={value} analyzedSnapshot={analyzedSnapshot} outOfDate={outOfDate} synthesis={{ status: "idle" }} bcnf={{ status: "idle" }} preservation={{ status: "idle" }} onGenerateSynthesis={() => undefined} onGenerateBcnf={() => undefined} onCheckPreservation={() => undefined} />);
}

describe("normal form educational reasoning", () => {
  it("explains Case A: 2NF satisfied but 3NF and BCNF violated", async () => {
    const user = userEvent.setup();
    view(result({ normalForms: {
      second: { satisfied: true, violations: [] },
      third: { satisfied: false, violations: [{ determinant: ["b"], dependent: "c" }] },
      bcnf: { satisfied: false, violations: [{ determinant: ["b"], dependent: "c" }] },
    } }));
    expect(screen.getByText("This is possible because 2NF only rules out partial dependencies on candidate keys, while 3NF also restricts other non-trivial dependencies.")).toBeTruthy();
    const group = screen.getByText("3NF violations").closest("details");
    if (!group) throw new Error("3NF group missing");
    await user.click(within(group).getByText("Why?"));
    expect(within(group).getAllByText("B → C").length).toBeGreaterThan(0);
    await user.click(within(group).getByText("Formal reasoning"));
    expect(within(group).getByText("Neither 3NF condition is true, so this dependency violates 3NF.")).toBeTruthy();
    expect(screen.getByLabelText("BCNF implies 3NF implies 2NF")).toBeTruthy();
  });

  it("explains Case B: 3NF satisfied but BCNF violated via the prime exception", () => {
    view(result({ candidateKeys: [["a", "c"]], primeAttributes: ["a", "b", "c"], normalForms: {
      second: { satisfied: true, violations: [] },
      third: { satisfied: true, violations: [] },
      bcnf: { satisfied: false, violations: [{ determinant: ["c"], dependent: "b" }] },
    } }));
    expect(screen.getByText("This relation satisfies 3NF but not BCNF because 3NF allows a non-superkey determinant when the dependent is prime. BCNF does not allow that exception.")).toBeTruthy();
    expect(screen.getByText("Every non-trivial implied dependency satisfies the superkey-or-prime condition.")).toBeTruthy();
    expect(screen.getAllByText("C → B").length).toBeGreaterThan(0);
    expect(screen.getByText("C is not a superkey.")).toBeTruthy();
  });

  it("keeps 2NF evidence exact for a composite key and handles an empty determinant", async () => {
    const user = userEvent.setup();
    view(result({ normalForms: {
      second: { satisfied: false, violations: [{ candidateKey: ["a", "b"], determinant: ["a"], dependent: "c" }] },
      third: { satisfied: true, violations: [] },
      bcnf: { satisfied: true, violations: [] },
    } }));
    const second = screen.getByText("2NF violations").closest("details");
    if (!second) throw new Error("2NF group missing");
    await user.click(within(second).getByText("Why?"));
    expect(within(second).getAllByText(/is a proper subset of/).length).toBeGreaterThan(0);
    expect(within(second).getByText("Because the determinant is a proper subset of the candidate key and the dependent is non-prime, this partial dependency violates 2NF.")).toBeTruthy();
    expect(within(second).getByText("Formal reasoning").closest("details")?.open).toBe(false);
  });

  it("renders an empty determinant as ∅ → A and keeps historical snapshot names", () => {
    const historical: SchemaInputDto = { ...snapshot, relation: { ...snapshot.relation, attributes: [{ id: "a", name: "Historical A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] } };
    view(result({ relation: historical.relation, normalForms: {
      second: { satisfied: false, violations: [] },
      third: { satisfied: false, violations: [{ determinant: [], dependent: "a" }] },
      bcnf: { satisfied: false, violations: [{ determinant: [], dependent: "a" }] },
    } }), historical, true);
    expect([...document.querySelectorAll(".violation-dependency")].some((node) => node.textContent === "∅ → Historical A")).toBe(true);
    expect(screen.getAllByText(/Historical A/).length).toBeGreaterThan(0);
    expect(screen.queryByText("A → Historical A")).toBeNull();
  });
});
