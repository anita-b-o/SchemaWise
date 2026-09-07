import { describe, expect, it } from "vitest";
import {
  analyzeThirdNormalForm,
  attributeClosure,
  Attribute,
  AttributeSet,
  findCandidateKeys,
  FunctionalDependency,
  Relation,
  synthesizeThirdNormalForm,
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

function relationIds(result: ReturnType<typeof synthesizeThirdNormalForm>) {
  return result.relations.map(({ attributes, source }) => ({
    attributes: attributes.toArray().map(({ id }) => id),
    source,
  }));
}

describe("synthesizeThirdNormalForm", () => {
  it("synthesizes the basic dependency-preserving decomposition", () => {
    const result = synthesizeThirdNormalForm(
      relation(a, b, c), [fd([a], [b]), fd([b], [c])],
    );

    expect(relationIds(result)).toEqual([
      { attributes: ["a", "b"], source: "minimal-cover" },
      { attributes: ["b", "c"], source: "minimal-cover" },
    ]);
    expect(result.addedCandidateKey).toBeNull();
  });

  it("groups singleton dependencies with the same determinant", () => {
    const result = synthesizeThirdNormalForm(
      relation(a, b, c), [fd([a], [b]), fd([a], [c])],
    );

    expect(relationIds(result)).toEqual([
      { attributes: ["a", "b", "c"], source: "minimal-cover" },
    ]);
  });

  it("removes a relation strictly contained in another", () => {
    const result = synthesizeThirdNormalForm(
      relation(a, b, c), [fd([a], [b]), fd([b, c], [a])],
    );

    expect(relationIds(result)).toEqual([
      { attributes: ["a", "b", "c"], source: "minimal-cover" },
    ]);
    expect(result.minimalCover).toHaveLength(2);
  });

  it("adds a candidate-key relation when no derived relation contains one", () => {
    const result = synthesizeThirdNormalForm(
      relation(a, b, c), [fd([a], [b])],
    );

    expect(relationIds(result)).toEqual([
      { attributes: ["a", "b"], source: "minimal-cover" },
      { attributes: ["a", "c"], source: "candidate-key" },
    ]);
    expect(result.addedCandidateKey?.toArray().map(({ id }) => id)).toEqual(["a", "c"]);
  });

  it("chooses the first canonical candidate key when several are available", () => {
    const result = synthesizeThirdNormalForm(
      relation(a, b, c), [fd([b], [a]), fd([a], [b])],
    );

    expect(result.addedCandidateKey?.toArray().map(({ id }) => id)).toEqual(["a", "c"]);
    expect(relationIds(result)).toContainEqual({
      attributes: ["a", "c"],
      source: "candidate-key",
    });
  });

  it("returns the whole relation as its key when there are no dependencies", () => {
    const result = synthesizeThirdNormalForm(relation(a, b, c), []);

    expect(relationIds(result)).toEqual([
      { attributes: ["a", "b", "c"], source: "candidate-key" },
    ]);
    expect(result.minimalCover).toEqual([]);
  });

  it("supports the empty determinant", () => {
    const result = synthesizeThirdNormalForm(
      relation(a, b, c), [fd([], [a]), fd([a], [b])],
    );

    expect(relationIds(result)).toEqual([
      { attributes: ["c"], source: "candidate-key" },
      { attributes: ["a", "b"], source: "minimal-cover" },
    ]);
    expect(result.addedCandidateKey?.toArray().map(({ id }) => id)).toEqual(["c"]);
  });

  it("deduplicates dependencies and handles an original multi-attribute RHS", () => {
    const dependency = fd([a], [b, c]);
    const result = synthesizeThirdNormalForm(
      relation(a, b, c), [dependency, dependency, fd([a], [b])],
    );

    expect(result.minimalCover).toHaveLength(2);
    expect(relationIds(result)).toEqual([
      { attributes: ["a", "b", "c"], source: "minimal-cover" },
    ]);
  });

  it("preserves every minimal-cover dependency in a resulting relation", () => {
    const result = synthesizeThirdNormalForm(
      relation(a, b, c, d), [fd([a], [b]), fd([b, c], [a]), fd([c], [d])],
    );

    for (const dependency of result.minimalCover) {
      const dependencyAttributes = dependency.left.union(dependency.right);
      expect(result.relations.some(({ attributes }) =>
        dependencyAttributes.isSubsetOf(attributes)
      )).toBe(true);
    }
  });

  it("produces relations in 3NF under their projected dependencies", () => {
    const cases = [
      [relation(a, b, c, d), [fd([a], [b]), fd([b], [c]), fd([c], [d])]],
      [relation(a, b, c), [fd([a], [b]), fd([b, c], [a])]],
      [relation(a, b, c), [fd([a], [b])]],
      [relation(a, b, c), [fd([], [a]), fd([a], [b])]],
    ] as const;

    for (const [schema, dependencies] of cases) {
      const result = synthesizeThirdNormalForm(schema, dependencies);
      for (const synthesized of result.relations) {
        const projected = projectDependencies(synthesized.attributes, dependencies);
        const scopedRelation = Relation.create("projected", synthesized.attributes);
        expect(analyzeThirdNormalForm(scopedRelation, projected).satisfied).toBe(true);
      }
    }
  });

  it("always leaves a relation containing a candidate key, without a general chase", () => {
    const cases = [
      [relation(a, b, c), [fd([a], [b]), fd([b], [c])]],
      [relation(a, b, c, d), [fd([a], [b]), fd([c], [d])]],
      [relation(a, b, c), []],
    ] as const;

    for (const [schema, dependencies] of cases) {
      const result = synthesizeThirdNormalForm(schema, dependencies);
      const candidateKeys = findCandidateKeys(schema, dependencies);
      expect(result.relations.some(({ attributes }) =>
        candidateKeys.some((key) => key.isSubsetOf(attributes))
      )).toBe(true);
    }
  });

  it("is canonical under attribute and dependency reordering", () => {
    const firstDependency = fd([a], [c, b]);
    const secondDependency = fd([c], [d]);
    const first = synthesizeThirdNormalForm(
      relation(d, c, b, a), [firstDependency, secondDependency],
    );
    const second = synthesizeThirdNormalForm(
      relation(a, b, c, d), [fd([c], [d]), fd([a], [b, c])],
    );

    expect(relationIds(first)).toEqual(relationIds(second));
    expect(first.minimalCover.map(dependencyIds)).toEqual(
      second.minimalCover.map(dependencyIds),
    );
  });

  it("rejects out-of-scope dependencies and identity collisions", () => {
    expect(() => synthesizeThirdNormalForm(
      relation(a, b), [fd([a], [c])],
    )).toThrow(/Functional dependency RHS.*external attribute ids: c/);

    const conflictingA = Attribute.create("a", "Account number");
    expect(() => synthesizeThirdNormalForm(
      relation(a, b), [fd([conflictingA], [b])],
    )).toThrow(/Attribute identity conflict/);
  });

  it("does not mutate inputs or expose mutable result collections", () => {
    const schema = relation(c, b, a);
    const left = set(a);
    const right = set(c, b);
    const dependency = FunctionalDependency.create(left, right);
    const relationBefore = schema.attributes.toArray();
    const leftBefore = left.toArray();
    const rightBefore = right.toArray();
    const result = synthesizeThirdNormalForm(schema, [dependency]);

    expect(schema.attributes.toArray()).toEqual(relationBefore);
    expect(left.toArray()).toEqual(leftBefore);
    expect(right.toArray()).toEqual(rightBefore);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.relations)).toBe(true);
    expect(Object.isFrozen(result.minimalCover)).toBe(true);
    expect(result.relations.every(Object.isFrozen)).toBe(true);
  });
});

function dependencyIds(dependency: FunctionalDependency) {
  return {
    left: dependency.left.toArray().map(({ id }) => id),
    right: dependency.right.toArray().map(({ id }) => id),
  };
}

function projectDependencies(
  attributes: AttributeSet,
  dependencies: readonly FunctionalDependency[],
): FunctionalDependency[] {
  const values = attributes.toArray();
  const projected: FunctionalDependency[] = [];

  for (let mask = 0; mask < 2 ** values.length; mask += 1) {
    const determinant = new AttributeSet(values.filter((_, index) => mask & (1 << index)));
    const closure = attributeClosure(determinant, dependencies);
    for (const dependent of closure.difference(determinant).toArray()) {
      if (attributes.has(dependent)) {
        projected.push(FunctionalDependency.create(determinant, set(dependent)));
      }
    }
  }

  return projected;
}
