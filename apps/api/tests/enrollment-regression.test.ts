import { describe, expect, it } from "vitest";
import { analyzeDependencyPreservationUseCase, analyzeSchema, decomposeBoyceCodd, synthesizeThirdNormalForm } from "../src/index.js";
import type { SchemaAnalysisRequestDto } from "../src/index.js";

export const enrollment: SchemaAnalysisRequestDto = {
  relation: {
    name: "Enrollment",
    attributes: [
      { id: "d", name: "Student" }, { id: "c", name: "Course" },
      { id: "a", name: "Professor" }, { id: "b", name: "Department" },
      { id: "e", name: "Grade" }, { id: "f", name: "Office" },
    ],
  },
  functionalDependencies: [
    { left: ["d", "c"], right: ["e"] },
    { left: ["c"], right: ["a"] },
    { left: ["a"], right: ["b"] },
    { left: ["a"], right: ["f"] },
    { left: ["b"], right: ["f"] },
  ],
};

function relationSets(relations: readonly { readonly attributes: readonly string[] }[]): string[] {
  const names = new Map(enrollment.relation.attributes.map(({ id, name }) => [id, name.toLowerCase()]));
  return relations.map(({ attributes }) => attributes.map((id) => names.get(id)!).sort().join(",")).sort();
}

describe("Enrollment regression", () => {
  it("retains candidate keys, minimal cover and full normal-form evidence", () => {
    const result = analyzeSchema(enrollment);
    expect(result.candidateKeys).toEqual([["c", "d"]]);
    expect(result.primeAttributes).toEqual(["c", "d"]);
    expect(result.minimalCover).toHaveLength(4);
    expect(result.minimalCover).toContainEqual({ left: ["a"], right: ["b"] });
    expect(result.minimalCover).toContainEqual({ left: ["b"], right: ["f"] });
    expect(result.minimalCover).toContainEqual({ left: ["c"], right: ["a"] });
    expect(result.minimalCover).toContainEqual({ left: ["c", "d"], right: ["e"] });
    expect(result.minimalCover).not.toContainEqual({ left: ["a"], right: ["f"] });
    expect(result.normalForms.second).toMatchObject({ satisfied: false, violations: expect.any(Array) });
    expect(result.normalForms.second.violations).toHaveLength(3);
    for (const dependent of ["a", "b", "f"]) {
      expect(result.normalForms.second.violations).toContainEqual({ candidateKey: ["c", "d"], determinant: ["c"], dependent });
    }
    expect(result.normalForms.third.satisfied).toBe(false);
    expect(result.normalForms.third.violations).toHaveLength(44);
    expect(result.normalForms.bcnf.satisfied).toBe(false);
    expect(result.normalForms.bcnf.violations).toHaveLength(44);
  });

  it("retains lossless, preserving 3NF synthesis and the BCNF preservation result", () => {
    const synthesis = synthesizeThirdNormalForm(enrollment);
    expect(relationSets(synthesis.relations)).toEqual([
      "course,grade,student", "course,professor", "department,office", "department,professor",
    ]);
    expect(synthesis.addedCandidateKey).toBeNull();
    expect(synthesis.relations.some(({ attributes }) => ["c", "d"].every((id) => attributes.includes(id)))).toBe(true);
    const synthesisPreservation = analyzeDependencyPreservationUseCase({ ...enrollment, decomposition: synthesis.relations.map(({ attributes }) => attributes) });
    expect(synthesisPreservation.preserved).toBe(true);
    expect(synthesisPreservation.lostDependencies).toEqual([]);

    const bcnf = decomposeBoyceCodd(enrollment);
    expect(relationSets(bcnf.relations)).toEqual([
      "course,grade,student", "course,professor", "department,professor", "office,professor",
    ]);
    expect(bcnf.steps).toHaveLength(3);
    const bcnfPreservation = analyzeDependencyPreservationUseCase({ ...enrollment, decomposition: bcnf.relations.map(({ attributes }) => attributes) });
    expect(bcnfPreservation.preserved).toBe(false);
    expect(bcnfPreservation.lostDependencies).toEqual([{ left: ["b"], right: ["f"] }]);
  });
});
