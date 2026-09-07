import { describe, expect, it } from "vitest";
import {
  attributeClosure,
  Attribute,
  AttributeSet,
  findMinimalCover,
  FunctionalDependency,
  projectFunctionalDependencies,
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

function dependencyIds(dependencies: readonly FunctionalDependency[]) {
  return dependencies.map((dependency) => ({
    left: dependency.left.toArray().map(({ id }) => id),
    right: dependency.right.toArray().map(({ id }) => id),
  }));
}

describe("projectFunctionalDependencies", () => {
  it("retains a dependency directly contained in the target schema", () => {
    const projected = projectFunctionalDependencies(
      relation(a, b, c), [fd([a], [b])], set(a, b),
    );

    expect(dependencyIds(projected)).toEqual([
      { left: ["a"], right: ["b"] },
    ]);
  });

  it("discovers dependencies implied through attributes outside the target schema", () => {
    const projected = projectFunctionalDependencies(
      relation(a, b, c), [fd([a], [b]), fd([b], [c])], set(a, c),
    );

    expect(dependencyIds(projected)).toEqual([
      { left: ["a"], right: ["c"] },
    ]);
  });

  it("does not invent a dependency when the dependent is unreachable", () => {
    const projected = projectFunctionalDependencies(
      relation(a, b, c), [fd([a], [b])], set(a, c),
    );

    expect(projected).toEqual([]);
  });

  it("preserves the implications of an internal chain", () => {
    const dependencies = [fd([a], [b]), fd([b], [c]), fd([c], [d])];
    const projected = projectFunctionalDependencies(
      relation(a, b, c, d), dependencies, set(a, c, d),
    );

    expect(dependencyIds(projected)).toEqual([
      { left: ["a"], right: ["c"] },
      { left: ["c"], right: ["d"] },
    ]);
    expectProjectionEquivalent(set(a, c, d), dependencies, projected);
  });

  it("terminates on cycles and projects both directions", () => {
    const projected = projectFunctionalDependencies(
      relation(a, b), [fd([a], [b]), fd([b], [a])], set(a, b),
    );

    expect(dependencyIds(projected)).toEqual([
      { left: ["a"], right: ["b"] },
      { left: ["b"], right: ["a"] },
    ]);
  });

  it("matches the existing minimal-cover policy when projecting onto all of R", () => {
    const schema = relation(a, b, c);
    const dependencies = [
      fd([a], [b, c]),
      fd([a], [b]),
      fd([b], [c]),
      fd([a, b], [a]),
    ];

    expect(dependencyIds(projectFunctionalDependencies(
      schema, dependencies, schema.attributes,
    ))).toEqual(dependencyIds(findMinimalCover(schema, dependencies)));
  });

  it("returns no non-trivial dependencies for a singleton without constants", () => {
    expect(projectFunctionalDependencies(
      relation(a, b), [fd([a], [b])], set(a),
    )).toEqual([]);
  });

  it("supports projection onto the empty attribute set", () => {
    expect(projectFunctionalDependencies(
      relation(a, b), [fd([], [a]), fd([a], [b])], set(),
    )).toEqual([]);
  });

  it("derives a dependency with an empty determinant", () => {
    const projected = projectFunctionalDependencies(
      relation(a, b), [fd([], [a]), fd([a], [b])], set(b),
    );

    expect(dependencyIds(projected)).toEqual([
      { left: [], right: ["b"] },
    ]);
  });

  it("does not return empty-RHS or trivial dependencies", () => {
    const projected = projectFunctionalDependencies(
      relation(a, b), [fd([a], []), fd([a, b], [a])], set(a, b),
    );

    expect(projected).toEqual([]);
  });

  it("deduplicates output and is independent of input order", () => {
    const schema = relation(c, b, a);
    const forward = [fd([a], [b]), fd([b], [c]), fd([a], [b])];
    const reversed = [...forward].reverse();

    expect(dependencyIds(projectFunctionalDependencies(
      schema, forward, set(c, a),
    ))).toEqual(dependencyIds(projectFunctionalDependencies(
      schema, reversed, set(a, c),
    )));
    expect(dependencyIds(projectFunctionalDependencies(
      schema, forward, set(c, a),
    ))).toEqual([{ left: ["a"], right: ["c"] }]);
  });

  it("rejects a target schema outside the original relation", () => {
    expect(() => projectFunctionalDependencies(
      relation(a, b), [], set(a, c),
    )).toThrow(/Input attributes.*external attribute ids: c/);
  });

  it("rejects out-of-scope dependencies and identity collisions", () => {
    expect(() => projectFunctionalDependencies(
      relation(a, b), [fd([c], [a])], set(a),
    )).toThrow(/Functional dependency LHS.*external attribute ids: c/);
    expect(() => projectFunctionalDependencies(
      relation(a, b), [fd([a], [c])], set(a),
    )).toThrow(/Functional dependency RHS.*external attribute ids: c/);

    const conflictingA = Attribute.create("a", "Account number");
    expect(() => projectFunctionalDependencies(
      relation(a, b), [fd([a], [b])], set(conflictingA),
    )).toThrow(/Attribute identity conflict/);
  });

  it("does not mutate inputs and returns a frozen result collection", () => {
    const schemaAttributes = set(c, b, a);
    const schema = Relation.create("R", schemaAttributes);
    const left = set(a);
    const right = set(b);
    const dependency = FunctionalDependency.create(left, right);
    const dependencies = [dependency];
    const target = set(b, a);
    const relationBefore = schema.attributes.toArray();
    const targetBefore = target.toArray();
    const leftBefore = left.toArray();
    const rightBefore = right.toArray();

    const projected = projectFunctionalDependencies(schema, dependencies, target);

    expect(schema.attributes.toArray()).toEqual(relationBefore);
    expect(schemaAttributes.toArray()).toEqual(relationBefore);
    expect(target.toArray()).toEqual(targetBefore);
    expect(left.toArray()).toEqual(leftBefore);
    expect(right.toArray()).toEqual(rightBefore);
    expect(dependencies).toEqual([dependency]);
    expect(Object.isFrozen(projected)).toBe(true);
    expect(projected.every(Object.isFrozen)).toBe(true);
  });

  it("preserves restricted closures for every subset in representative schemas", () => {
    const cases = [
      {
        target: set(a, c),
        dependencies: [fd([a], [b]), fd([b], [c])],
        schema: relation(a, b, c),
      },
      {
        target: set(a, c, d),
        dependencies: [fd([a], [b]), fd([b], [c]), fd([c], [d])],
        schema: relation(a, b, c, d),
      },
      {
        target: set(a, b),
        dependencies: [fd([a], [b]), fd([b], [a])],
        schema: relation(a, b),
      },
      {
        target: set(b),
        dependencies: [fd([], [a]), fd([a], [b])],
        schema: relation(a, b),
      },
      {
        target: set(),
        dependencies: [fd([], [a])],
        schema: relation(a),
      },
    ];

    for (const { target, dependencies, schema } of cases) {
      const projected = projectFunctionalDependencies(schema, dependencies, target);
      expectProjectionEquivalent(target, dependencies, projected);
    }
  });
});

function expectProjectionEquivalent(
  target: AttributeSet,
  original: readonly FunctionalDependency[],
  projected: readonly FunctionalDependency[],
): void {
  for (const subset of subsets(target)) {
    const restrictedOriginalClosure = intersection(attributeClosure(subset, original), target);
    const projectedClosure = attributeClosure(subset, projected);
    expect(projectedClosure.equals(restrictedOriginalClosure)).toBe(true);
  }
}

function subsets(attributes: AttributeSet): AttributeSet[] {
  const result: AttributeSet[] = [set()];
  for (const attribute of attributes.toArray()) {
    result.push(...result.map((subset) => subset.union(set(attribute))));
  }
  return result;
}

function intersection(left: AttributeSet, right: AttributeSet): AttributeSet {
  return new AttributeSet(left.toArray().filter((attribute) => right.has(attribute)));
}
