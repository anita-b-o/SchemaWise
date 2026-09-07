import { describe, expect, it } from "vitest";
import {
  analyzeThirdNormalForm,
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

function violationIds(analysis: ReturnType<typeof analyzeThirdNormalForm>) {
  return analysis.violations.map(({ determinant, dependent }) => ({
    determinant: determinant.toArray().map(({ id }) => id),
    dependent: dependent.id,
  }));
}

describe("analyzeThirdNormalForm", () => {
  it("satisfies 3NF when every non-trivial determinant is a superkey", () => {
    const analysis = analyzeThirdNormalForm(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB]), dependency([attributeA], [attributeC])],
    );

    expect(analysis).toEqual({ satisfied: true, violations: [] });
  });

  it("detects the classic non-superkey to non-prime violation", () => {
    const analysis = analyzeThirdNormalForm(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB]), dependency([attributeB], [attributeC])],
    );

    expect(violationIds(analysis)).toContainEqual({ determinant: ["b"], dependent: "c" });
    expect(analysis.satisfied).toBe(false);
  });

  it("accepts a non-superkey determinant when the dependent is prime", () => {
    const analysis = analyzeThirdNormalForm(
      relation(attributeA, attributeB, attributeC),
      [
        dependency([attributeA, attributeB], [attributeC]),
        dependency([attributeC], [attributeB]),
      ],
    );

    expect(analysis).toEqual({ satisfied: true, violations: [] });
  });

  it("does not report a trivial dependency", () => {
    const analysis = analyzeThirdNormalForm(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA, attributeB], [attributeA])],
    );

    expect(violationIds(analysis)).not.toContainEqual({
      determinant: ["a", "b"],
      dependent: "a",
    });
    expect(analysis.satisfied).toBe(true);
  });

  it("detects a violating dependency implied by transitive closure", () => {
    const analysis = analyzeThirdNormalForm(
      relation(attributeA, attributeB, attributeC, attributeD),
      [
        dependency([attributeA], [attributeB]),
        dependency([attributeB], [attributeC]),
        dependency([attributeC], [attributeD]),
      ],
    );

    expect(violationIds(analysis)).toContainEqual({ determinant: ["b"], dependent: "d" });
  });

  it("uses every candidate key when identifying prime attributes", () => {
    const analysis = analyzeThirdNormalForm(
      relation(attributeA, attributeB, attributeC),
      [
        dependency([attributeA, attributeB], [attributeC]),
        dependency([attributeC], [attributeB]),
      ],
    );

    expect(analysis.satisfied).toBe(true);
  });

  it("reports an empty non-superkey determinant of a non-prime attribute", () => {
    const analysis = analyzeThirdNormalForm(
      relation(attributeA, attributeB, attributeC),
      [dependency([], [attributeC])],
    );

    expect(violationIds(analysis)).toContainEqual({ determinant: [], dependent: "c" });
    expect(analysis.satisfied).toBe(false);
  });

  it("accepts the empty determinant when it is a superkey", () => {
    const analysis = analyzeThirdNormalForm(
      relation(attributeA, attributeB, attributeC),
      [dependency([], [attributeA, attributeB, attributeC])],
    );

    expect(analysis).toEqual({ satisfied: true, violations: [] });
  });

  it("terminates on cycles", () => {
    const analysis = analyzeThirdNormalForm(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB]), dependency([attributeB], [attributeA])],
    );

    expect(analysis.satisfied).toBe(true);
  });

  it("rejects dependencies outside the relation scope", () => {
    expect(() => analyzeThirdNormalForm(
      relation(attributeA, attributeB),
      [dependency([attributeA], [attributeC])],
    )).toThrow(/Functional dependency RHS.*external attribute ids: c/);
  });

  it("rejects identity collisions", () => {
    const conflictingA = Attribute.create("a", "Account number");

    expect(() => analyzeThirdNormalForm(
      relation(attributeA, attributeB),
      [dependency([conflictingA], [attributeB])],
    )).toThrow(/Attribute identity conflict/);
  });

  it("returns immutable, canonical diagnostics without mutating inputs", () => {
    const schemaAttributes = attributes(attributeD, attributeC, attributeB, attributeA);
    const schema = Relation.create("R", schemaAttributes);
    const left = attributes(attributeB);
    const right = attributes(attributeD, attributeC);
    const dependencies = [
      FunctionalDependency.create(left, right),
      dependency([attributeA], [attributeB]),
    ];
    const relationBefore = schema.attributes.toArray();
    const leftBefore = left.toArray();
    const rightBefore = right.toArray();

    const first = analyzeThirdNormalForm(schema, dependencies);
    const second = analyzeThirdNormalForm(schema, [...dependencies].reverse());

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
