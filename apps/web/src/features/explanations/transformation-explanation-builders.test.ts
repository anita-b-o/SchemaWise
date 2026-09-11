import { describe, expect, it } from "vitest";
import type { BcnfDecompositionResponseDto, DependencyPreservationResponseDto, SchemaInputDto, ThirdNormalFormSynthesisResponseDto } from "../../api/schemawise-contracts";
import { buildBcnfDecompositionExplanation, buildBcnfStepExplanation, buildDependencyPreservationExplanation, buildThirdNormalFormSynthesisExplanation } from "./explanation-builders";

const snapshot: SchemaInputDto = {
  relation: { name: "R", attributes: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] },
  functionalDependencies: [{ left: ["a"], right: ["b"] }, { left: ["b"], right: ["c"] }],
};

describe("transformation educational builders", () => {
  it("separates 3NF algorithm guarantees from DTO and snapshot evidence", () => {
    const response: ThirdNormalFormSynthesisResponseDto = {
      relations: [{ attributes: ["a", "b"], source: "minimal-cover" }, { attributes: ["b", "c"], source: "minimal-cover" }],
      minimalCover: snapshot.functionalDependencies,
      addedCandidateKey: null,
    };
    const explanation = buildThirdNormalFormSynthesisExplanation(response, snapshot);

    expect(explanation.guaranteedByAlgorithm.map((fact) => fact.source)).toEqual([
      "operation-contract", "operation-contract", "operation-contract",
    ]);
    expect(explanation.usedEvidence.map((fact) => fact.source)).toEqual([
      "dto", "dto", "dto", "dto", "snapshot", "derived-presentation",
    ]);
    expect(JSON.stringify(explanation)).toContain("no additional candidate-key relation was required");
    expect(JSON.stringify(explanation)).not.toContain("independently verified");
  });

  it("uses the added candidate key and relation source exactly as returned", () => {
    const response: ThirdNormalFormSynthesisResponseDto = {
      relations: [{ attributes: ["a", "b"], source: "minimal-cover" }, { attributes: ["a", "c"], source: "candidate-key" }],
      minimalCover: [{ left: ["a"], right: ["b"] }],
      addedCandidateKey: ["a", "c"],
    };
    const serialized = JSON.stringify(buildThirdNormalFormSynthesisExplanation(response, snapshot));
    expect(serialized).toContain("candidate-key provenance");
    expect(serialized).toContain('"ids":["a","c"]');
  });

  it("keeps BCNF leaf guarantees contractual and step facts DTO-sourced", () => {
    const response: BcnfDecompositionResponseDto = {
      relations: [{ attributes: ["b", "c"] }, { attributes: ["a", "b"] }],
      steps: [{ source: ["a", "b", "c"], violation: { determinant: ["b"], dependent: "c" }, result: [["b", "c"], ["a", "b"]] }],
    };
    const decomposition = buildBcnfDecompositionExplanation(response, snapshot);
    const step = buildBcnfStepExplanation(response.steps[0]!, snapshot);

    expect(decomposition.guaranteedByAlgorithm.every((fact) => fact.source === "operation-contract")).toBe(true);
    expect(JSON.stringify(decomposition)).toContain("Dependency preservation is not implied by lossless join");
    expect(step.formal?.evidence.every((fact) => fact.source === "dto")).toBe(true);
    expect(JSON.stringify(step)).toContain("singleton dependent");
    expect(JSON.stringify(step)).not.toContain("chase was run");
  });

  it.each([
    { preserved: true, preservedDependencies: [{ left: ["a"], right: ["b"] }], lostDependencies: [] },
    { preserved: false, preservedDependencies: [{ left: ["b"], right: ["c"] }], lostDependencies: [{ left: ["a", "b"], right: ["c"] }] },
  ] satisfies DependencyPreservationResponseDto[])("treats preservation $preserved as checked DTO evidence", (response) => {
    const explanation = buildDependencyPreservationExplanation(response);
    expect(explanation.guaranteedByAlgorithm).toEqual([]);
    expect(explanation.usedEvidence.every((fact) => fact.source === "dto")).toBe(true);
    expect(JSON.stringify(explanation)).toContain("operation contract, not a request execution trace");
    expect(JSON.stringify(explanation)).not.toContain("directly in a final relation");
  });
});
