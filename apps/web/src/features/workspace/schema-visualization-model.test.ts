import { describe, expect, it } from "vitest";
import type { AnalysisResponseDto, BcnfDecompositionResponseDto, DependencyPreservationResponseDto, SchemaInputDto, ThirdNormalFormSynthesisResponseDto } from "../../api/schemawise-contracts";
import { buildAnalysisDiagramModel, buildBcnfDiagramModel, buildPreservationDiagramModel, buildSchemaDiagramModel, buildSynthesisDiagramModel } from "./schema-visualization-model";

const snapshot: SchemaInputDto = {
  relation: { name: "R", attributes: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] },
  functionalDependencies: [{ left: ["a"], right: ["b"] }, { left: ["b"], right: ["c"] }],
};

function analysis(overrides: Partial<AnalysisResponseDto> = {}): AnalysisResponseDto {
  return {
    relation: snapshot.relation,
    candidateKeys: [["a"]],
    primeAttributes: ["a"],
    minimalCover: snapshot.functionalDependencies,
    normalForms: {
      second: { satisfied: true, violations: [] },
      third: { satisfied: false, violations: [{ determinant: ["b"], dependent: "c" }] },
      bcnf: { satisfied: false, violations: [{ determinant: ["b"], dependent: "c" }] },
    },
    ...overrides,
  };
}

describe("schema visualization presentation builders", () => {
  it("A: preserves the explicit A to B to C dependency sequence", () => {
    const model = buildSchemaDiagramModel(snapshot);
    expect(model.dependencies.map(({ left, right }) => ({ left, right }))).toEqual([
      { left: ["a"], right: ["b"] },
      { left: ["b"], right: ["c"] },
    ]);
  });

  it("B: keeps AB to C as one composite determinant and never invents A to C or B to C", () => {
    const composite: SchemaInputDto = {
      ...snapshot,
      functionalDependencies: [{ left: ["a", "b"], right: ["c"] }, { left: ["c"], right: ["b"] }],
    };
    const model = buildSchemaDiagramModel(composite);
    expect(model.dependencies).toHaveLength(2);
    expect(model.dependencies[0]).toMatchObject({ left: ["a", "b"], right: ["c"] });
    expect(model.dependencies.some((dependency) => dependency.left.length === 1 && dependency.left[0] === "a" && dependency.right.length === 1 && dependency.right[0] === "c")).toBe(false);
    expect(model.dependencies.some((dependency) => dependency.left.length === 1 && dependency.left[0] === "b" && dependency.right.length === 1 && dependency.right[0] === "c")).toBe(false);
  });

  it("C: maps composite-key 2NF evidence without evaluating it", () => {
    const model = buildAnalysisDiagramModel(snapshot, analysis({
      candidateKeys: [["a", "b"]],
      primeAttributes: ["a", "b"],
      normalForms: {
        second: { satisfied: false, violations: [{ candidateKey: ["a", "b"], determinant: ["a"], dependent: "c" }] },
        third: { satisfied: true, violations: [] },
        bcnf: { satisfied: true, violations: [] },
      },
    }));
    expect(model.violations[0]).toMatchObject({ normalForm: "2NF", candidateKey: ["a", "b"], determinant: ["a"], dependent: "c" });
  });

  it("D: retains multiple candidate keys and prime attributes exactly", () => {
    const model = buildAnalysisDiagramModel(snapshot, analysis({ candidateKeys: [["a", "b"], ["a", "c"]], primeAttributes: ["a", "b", "c"] }));
    expect(model.candidateKeys.map((key) => key.attributes)).toEqual([["a", "b"], ["a", "c"]]);
    expect(model.attributes.filter((attribute) => attribute.prime).map((attribute) => attribute.id)).toEqual(["a", "b", "c"]);
  });

  it("E: retains every BCNF split in DTO order", () => {
    const response: BcnfDecompositionResponseDto = {
      relations: [{ attributes: ["b", "c"] }, { attributes: ["a", "b"] }],
      steps: [
        { source: ["a", "b", "c"], violation: { determinant: ["b"], dependent: "c" }, result: [["b", "c"], ["a", "b"]] },
        { source: ["a", "b"], violation: { determinant: ["a"], dependent: "b" }, result: [["a", "b"], ["a"]] },
      ],
    };
    const model = buildBcnfDiagramModel(snapshot, response);
    expect(model.steps.map((step) => step.violation.left)).toEqual([["b"], ["a"]]);
    expect(model.steps[0]?.sourceIsOriginal).toBe(true);
    expect(model.steps[1]?.sourceIsOriginal).toBe(false);
  });

  it("F: maps only lost dependencies into preservation evidence", () => {
    const response: DependencyPreservationResponseDto = {
      preserved: false,
      preservedDependencies: [{ left: ["a"], right: ["b"] }],
      lostDependencies: [{ left: ["a", "b"], right: ["c"] }],
    };
    expect(buildPreservationDiagramModel(response)).toMatchObject({ preserved: false, lostDependencies: [{ left: ["a", "b"], right: ["c"], source: "lost" }] });
  });

  it("G: preserves an empty determinant as an explicit dependency endpoint", () => {
    const model = buildSchemaDiagramModel({ ...snapshot, functionalDependencies: [{ left: [], right: ["a"] }] });
    expect(model.dependencies[0]).toMatchObject({ left: [], right: ["a"] });
  });

  it("H: creates a stable empty dependency collection", () => {
    expect(buildSchemaDiagramModel({ ...snapshot, functionalDependencies: [] }).dependencies).toEqual([]);
  });

  it("I: preserves long labels without shortening the accessible model", () => {
    const longLabel = "customer_account_identifier_".repeat(5).slice(0, 120);
    const model = buildSchemaDiagramModel({ relation: { name: "R", attributes: [{ id: "a", name: longLabel }] }, functionalDependencies: [] });
    expect(model.attributes[0]?.label).toBe(longLabel);
    expect(model.attributes[0]?.label).toHaveLength(120);
  });

  it("maps synthesis relation sources and candidate-key evidence without inventing causality", () => {
    const response: ThirdNormalFormSynthesisResponseDto = {
      relations: [{ attributes: ["a", "b"], source: "minimal-cover" }, { attributes: ["a", "c"], source: "candidate-key" }],
      minimalCover: [{ left: ["a"], right: ["b"] }],
      addedCandidateKey: ["a", "c"],
    };
    const model = buildSynthesisDiagramModel(snapshot, response);
    expect(model.relations.map(({ attributes, source }) => ({ attributes, source }))).toEqual([
      { attributes: ["a", "b"], source: "minimal-cover" },
      { attributes: ["a", "c"], source: "candidate-key" },
    ]);
    expect(model.addedCandidateKey).toEqual(["a", "c"]);
  });
});
