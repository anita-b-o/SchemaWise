import { describe, expect, it } from "vitest";
import {
  analyzeSecondNormalForm,
  Attribute,
  AttributeSet,
  FunctionalDependency,
  Relation,
} from "../src/index.js";

const attributeA = Attribute.create("a", "A");
const attributeB = Attribute.create("b", "B");
const attributeC = Attribute.create("c", "C");
const attributeD = Attribute.create("d", "D");

function attributes(...values: Attribute[]): AttributeSet {
  return new AttributeSet(values);
}

function dependency(left: Attribute[], right: Attribute[]): FunctionalDependency {
  return FunctionalDependency.create(attributes(...left), attributes(...right));
}

function relation(...values: Attribute[]): Relation {
  return Relation.create("R", attributes(...values));
}

function violationIds(analysis: ReturnType<typeof analyzeSecondNormalForm>) {
  return analysis.violations.map(({ candidateKey, determinant, dependent }) => ({
    candidateKey: candidateKey.toArray().map(({ id }) => id),
    determinant: determinant.toArray().map(({ id }) => id),
    dependent: dependent.id,
  }));
}

describe("analyzeSecondNormalForm", () => {
  it("satisfies 2NF when its candidate key is a singleton", () => {
    const analysis = analyzeSecondNormalForm(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB]), dependency([attributeA], [attributeC])],
    );

    expect(analysis).toEqual({ satisfied: true, violations: [] });
  });

  it("detects a classic partial dependency from a proper key subset", () => {
    const analysis = analyzeSecondNormalForm(
      relation(attributeA, attributeB, attributeC),
      [
        dependency([attributeA, attributeB], [attributeC]),
        dependency([attributeA], [attributeC]),
      ],
    );

    expect(violationIds(analysis)).toContainEqual({
      candidateKey: ["a", "b"],
      determinant: ["a"],
      dependent: "c",
    });
    expect(analysis.satisfied).toBe(false);
  });

  it("detects a partial dependency implied through attribute closure", () => {
    const analysis = analyzeSecondNormalForm(
      relation(attributeA, attributeB, attributeC, attributeD),
      [
        dependency([attributeA, attributeB], [attributeD]),
        dependency([attributeA], [attributeC]),
        dependency([attributeC], [attributeD]),
      ],
    );

    expect(violationIds(analysis)).toContainEqual({
      candidateKey: ["a", "b"],
      determinant: ["a"],
      dependent: "d",
    });
  });

  it("does not treat a dependency toward a prime attribute as a violation", () => {
    const analysis = analyzeSecondNormalForm(
      relation(attributeA, attributeB, attributeC),
      [
        dependency([attributeA, attributeB], [attributeC]),
        dependency([attributeC], [attributeB]),
      ],
    );

    expect(analysis).toEqual({ satisfied: true, violations: [] });
  });

  it("evaluates every candidate key and reports violations for each affected key", () => {
    const analysis = analyzeSecondNormalForm(
      relation(attributeA, attributeB, attributeC, attributeD),
      [
        dependency([attributeA], [attributeB, attributeD]),
        dependency([attributeB], [attributeA]),
      ],
    );

    expect(violationIds(analysis)).toEqual([
      { candidateKey: ["a", "c"], determinant: ["a"], dependent: "d" },
      { candidateKey: ["b", "c"], determinant: ["b"], dependent: "d" },
    ]);
    expect(analysis.satisfied).toBe(false);
  });

  it("satisfies 2NF without functional dependencies", () => {
    expect(analyzeSecondNormalForm(
      relation(attributeA, attributeB, attributeC),
      [],
    )).toEqual({ satisfied: true, violations: [] });
  });

  it("handles the empty candidate key using proper-subset semantics", () => {
    const analysis = analyzeSecondNormalForm(
      relation(attributeA, attributeB),
      [dependency([], [attributeA]), dependency([attributeA], [attributeB])],
    );

    expect(analysis).toEqual({ satisfied: true, violations: [] });
  });

  it("rejects dependencies outside the relation scope", () => {
    expect(() => analyzeSecondNormalForm(
      relation(attributeA, attributeB),
      [dependency([attributeA], [attributeC])],
    )).toThrow(/Functional dependency RHS.*external attribute ids: c/);
  });

  it("rejects identity collisions", () => {
    const conflictingA = Attribute.create("a", "Account number");

    expect(() => analyzeSecondNormalForm(
      relation(attributeA, attributeB),
      [dependency([conflictingA], [attributeB])],
    )).toThrow(/Attribute identity conflict/);
  });

  it("returns immutable, deterministic diagnostics without mutating inputs", () => {
    const schemaAttributes = attributes(attributeD, attributeC, attributeB, attributeA);
    const schema = Relation.create("R", schemaAttributes);
    const left = attributes(attributeB);
    const right = attributes(attributeA, attributeD);
    const dependencies = [
      FunctionalDependency.create(left, right),
      dependency([attributeA], [attributeB]),
    ];
    const relationBefore = schema.attributes.toArray();
    const leftBefore = left.toArray();
    const rightBefore = right.toArray();

    const first = analyzeSecondNormalForm(schema, dependencies);
    const second = analyzeSecondNormalForm(schema, [...dependencies].reverse());

    expect(violationIds(first)).toEqual(violationIds(second));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.violations)).toBe(true);
    expect(first.violations.every(Object.isFrozen)).toBe(true);
    expect(schema.attributes.toArray()).toEqual(relationBefore);
    expect(schemaAttributes.toArray()).toEqual(relationBefore);
    expect(left.toArray()).toEqual(leftBefore);
    expect(right.toArray()).toEqual(rightBefore);
  });
});
