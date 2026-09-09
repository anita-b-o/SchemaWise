import { describe, expect, it } from "vitest";
import { analyzeDependencyPreservationUseCase, analyzeSchema, calculateClosure, decomposeBoyceCodd, synthesizeThirdNormalForm } from "../src/index.js";
import type { SchemaAnalysisRequestDto } from "../src/index.js";

const schema: SchemaAnalysisRequestDto = {
  relation: { name: "R", attributes: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] },
  functionalDependencies: [{ left: ["a"], right: ["b"] }, { left: ["b"], right: ["c"] }],
};

describe("application layer", () => {
  it("maps an aggregate analysis without exposing domain objects", () => {
    const result = analyzeSchema(schema);
    expect(result.candidateKeys).toEqual([["a"]]);
    expect(result.primeAttributes).toEqual(["a"]);
    expect(result.normalForms.second.satisfied).toBe(true);
    expect(result.normalForms.third.violations).toEqual([{ determinant: ["b"], dependent: "c" }]);
    expect(result.normalForms.bcnf.violations).toEqual([{ determinant: ["b"], dependent: "c" }]);
    expect(result.relation.attributes[0]).toEqual({ id: "a", name: "A" });
  });

  it("resolves closure and preserves canonical engine ordering", () => {
    expect(calculateClosure({ ...schema, attributes: ["a"] })).toEqual({ closure: ["a", "b", "c"] });
  });

  it("maps empty determinants and RHS", () => {
    const result = analyzeSchema({ relation: schema.relation, functionalDependencies: [{ left: [], right: ["a"] }, { left: ["a"], right: [] }] });
    expect(result.minimalCover).toEqual([{ left: [], right: ["a"] }]);
  });

  it("maps synthesis and BCNF decomposition evidence", () => {
    expect(synthesizeThirdNormalForm({ relation: schema.relation, functionalDependencies: [{ left: ["a"], right: ["b"] }] })).toEqual({ addedCandidateKey: ["a", "c"], minimalCover: [{ left: ["a"], right: ["b"] }], relations: [{ attributes: ["a", "b"], source: "minimal-cover" }, { attributes: ["a", "c"], source: "candidate-key" }] });
    expect(decomposeBoyceCodd(schema).steps[0]).toEqual({ source: ["a", "b", "c"], violation: { determinant: ["b"], dependent: "c" }, result: [["b", "c"], ["a", "b"]] });
  });

  it("serializes preserved and lost dependencies", () => {
    const result = analyzeDependencyPreservationUseCase({ ...schema, decomposition: [["a", "b"], ["b", "c"]] });
    expect(result.preserved).toBe(true);
    expect(result.preservedDependencies).toEqual([{ left: ["a"], right: ["b"] }, { left: ["b"], right: ["c"] }]);
    expect(result.lostDependencies).toEqual([]);
  });

  it.each([
    ["unknown attribute", { ...schema, functionalDependencies: [{ left: ["x"], right: ["a"] }] }, "UNKNOWN_ATTRIBUTE_REFERENCE"],
    ["collision", { ...schema, relation: { ...schema.relation, attributes: [{ id: "a", name: "A" }, { id: "a", name: "Other" }] } }, "ATTRIBUTE_IDENTITY_COLLISION"],
    ["seven attributes", { ...schema, relation: { ...schema.relation, attributes: Array.from({ length: 7 }, (_, i) => ({ id: String.fromCharCode(97 + i), name: String.fromCharCode(65 + i) })) } }, "ANALYSIS_LIMIT_EXCEEDED"],
    ["thirteen fds", { ...schema, functionalDependencies: Array.from({ length: 13 }, () => ({ left: ["a"], right: ["b"] })) }, "ANALYSIS_LIMIT_EXCEEDED"],
  ])("returns the public error code for %s", (_label, input, code) => {
    expect(() => analyzeSchema(input as SchemaAnalysisRequestDto)).toThrow(expect.objectContaining({ code }));
  });

  it("rejects incomplete decomposition", () => {
    expect(() => analyzeDependencyPreservationUseCase({ ...schema, decomposition: [["a", "b"]] })).toThrow(expect.objectContaining({ code: "INCOMPLETE_DECOMPOSITION" }));
  });

  it("is deterministic across repeated calls", () => {
    expect(analyzeSchema(schema)).toEqual(analyzeSchema(schema));
  });
});
