import { describe, expect, it } from "vitest";
import {
  analyzeBoyceCoddNormalForm,
  analyzeThirdNormalForm,
  Attribute,
  AttributeSet,
  FunctionalDependency,
  Relation,
} from "../src/index.js";

const a = Attribute.create("a", "A");
const b = Attribute.create("b", "B");
const c = Attribute.create("c", "C");
const d = Attribute.create("d", "D");

function set(...values: Attribute[]): AttributeSet {
  return new AttributeSet(values);
}

function fd(left: Attribute[], right: Attribute[]): FunctionalDependency {
  return FunctionalDependency.create(set(...left), set(...right));
}

function relation(...values: Attribute[]): Relation {
  return Relation.create("R", set(...values));
}

function ids(analysis: ReturnType<typeof analyzeBoyceCoddNormalForm>) {
  return analysis.violations.map(({ determinant, dependent }) => ({
    determinant: determinant.toArray().map(({ id }) => id),
    dependent: dependent.id,
  }));
}

describe("analyzeBoyceCoddNormalForm", () => {
  it("accepts a relation whose determinants are superkeys", () => {
    expect(analyzeBoyceCoddNormalForm(
      relation(a, b, c), [fd([a], [b]), fd([a], [c])],
    )).toEqual({ satisfied: true, violations: [] });
  });

  it("detects the classical BCNF violation", () => {
    const analysis = analyzeBoyceCoddNormalForm(
      relation(a, b, c), [fd([a], [b]), fd([b], [c])],
    );
    expect(ids(analysis)).toContainEqual({ determinant: ["b"], dependent: "c" });
    expect(analysis.satisfied).toBe(false);
  });

  it("distinguishes 3NF from BCNF when the dependent is prime", () => {
    const dependencies = [fd([a, b], [c]), fd([c], [b])];
    expect(analyzeThirdNormalForm(relation(a, b, c), dependencies).satisfied).toBe(true);
    expect(analyzeBoyceCoddNormalForm(relation(a, b, c), dependencies).satisfied).toBe(false);
    expect(ids(analyzeBoyceCoddNormalForm(relation(a, b, c), dependencies)))
      .toContainEqual({ determinant: ["c"], dependent: "b" });
  });

  it("ignores trivial dependencies and detects implied dependencies", () => {
    const analysis = analyzeBoyceCoddNormalForm(
      relation(a, b, c, d), [fd([a, b], [a]), fd([a], [b]), fd([b], [c]), fd([c], [d])],
    );
    expect(ids(analysis)).not.toContainEqual({ determinant: ["a", "b"], dependent: "a" });
    expect(ids(analysis)).toContainEqual({ determinant: ["b"], dependent: "d" });
  });

  it("handles multiple keys, empty determinants, cycles, and no dependencies", () => {
    expect(analyzeBoyceCoddNormalForm(relation(a, b, c), []).satisfied).toBe(true);
    expect(analyzeBoyceCoddNormalForm(
      relation(a, b), [fd([], [a, b])],
    ).satisfied).toBe(true);
    expect(analyzeBoyceCoddNormalForm(
      relation(a, b, c), [fd([], [a])],
    ).satisfied).toBe(false);
    expect(analyzeBoyceCoddNormalForm(
      relation(a, b, c), [fd([a], [b]), fd([b], [a])],
    ).satisfied).toBe(false);
    expect(analyzeBoyceCoddNormalForm(
      relation(a, b, c), [fd([a, b], [c]), fd([a, c], [b])],
    ).satisfied).toBe(true);
  });

  it("preserves scope and identity validation", () => {
    expect(() => analyzeBoyceCoddNormalForm(
      relation(a, b), [fd([a], [c])],
    )).toThrow(/Functional dependency RHS.*external attribute ids: c/);
    const conflictingA = Attribute.create("a", "Account number");
    expect(() => analyzeBoyceCoddNormalForm(
      relation(a, b), [fd([conflictingA], [b])],
    )).toThrow(/Attribute identity conflict/);
  });

  it("is canonical, immutable, and independent of input order", () => {
    const schema = relation(d, c, b, a);
    const left = set(b);
    const right = set(d, c);
    const dependencies = [FunctionalDependency.create(left, right), fd([a], [b])];
    const relationBefore = schema.attributes.toArray();
    const leftBefore = left.toArray();
    const rightBefore = right.toArray();
    const first = analyzeBoyceCoddNormalForm(schema, dependencies);
    const second = analyzeBoyceCoddNormalForm(schema, [...dependencies].reverse());
    expect(ids(first)).toEqual(ids(second));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.violations)).toBe(true);
    expect(first.violations.every(Object.isFrozen)).toBe(true);
    expect(schema.attributes.toArray()).toEqual(relationBefore);
    expect(left.toArray()).toEqual(leftBefore);
    expect(right.toArray()).toEqual(rightBefore);
  });
});

describe("normal form hierarchy", () => {
  it("captures BCNF implies 3NF", () => {
    const cases = [
      [relation(a, b, c), [fd([a], [b]), fd([a], [c])]],
      [relation(a, b, c), []],
      [relation(a, b, c), [fd([], [a, b, c])]],
    ] as const;
    for (const [schema, dependencies] of cases) {
      const bcnf = analyzeBoyceCoddNormalForm(schema, dependencies);
      const third = analyzeThirdNormalForm(schema, dependencies);
      expect(bcnf.satisfied).toBe(true);
      expect(third.satisfied).toBe(true);
    }
  });
});
