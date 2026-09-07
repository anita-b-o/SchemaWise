import { describe, expect, it } from "vitest";
import {
  attributeClosure,
  Attribute,
  AttributeSet,
  findMinimalCover,
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

function dependencyIds(value: FunctionalDependency): [string[], string[]] {
  return [
    value.left.toArray().map(({ id }) => id),
    value.right.toArray().map(({ id }) => id),
  ];
}

function coverIds(values: readonly FunctionalDependency[]): [string[], string[]][] {
  return values.map(dependencyIds);
}

function expectEquivalent(
  original: readonly FunctionalDependency[],
  cover: readonly FunctionalDependency[],
): void {
  for (const { left, right } of original) {
    expect(right.isSubsetOf(attributeClosure(left, cover))).toBe(true);
  }
  for (const { left, right } of cover) {
    expect(right.isSubsetOf(attributeClosure(left, original))).toBe(true);
  }
}

describe("findMinimalCover", () => {
  it("decomposes a multiple-attribute RHS into singleton dependencies", () => {
    const original = [dependency([attributeA], [attributeB, attributeC])];
    const cover = findMinimalCover(relation(attributeA, attributeB, attributeC), original);

    expect(coverIds(cover)).toEqual([
      [["a"], ["b"]],
      [["a"], ["c"]],
    ]);
    expectEquivalent(original, cover);
  });

  it("removes an extraneous attribute from a composite LHS", () => {
    const original = [
      dependency([attributeA, attributeB], [attributeC]),
      dependency([attributeA], [attributeB]),
    ];
    const cover = findMinimalCover(relation(attributeA, attributeB, attributeC), original);

    expect(coverIds(cover)).toEqual([
      [["a"], ["b"]],
      [["a"], ["c"]],
    ]);
    expectEquivalent(original, cover);
  });

  it("removes a redundant dependency", () => {
    const original = [
      dependency([attributeA], [attributeB]),
      dependency([attributeB], [attributeC]),
      dependency([attributeA], [attributeC]),
    ];
    const cover = findMinimalCover(relation(attributeA, attributeB, attributeC), original);

    expect(coverIds(cover)).toEqual([
      [["a"], ["b"]],
      [["b"], ["c"]],
    ]);
    expectEquivalent(original, cover);
  });

  it("performs RHS decomposition, LHS reduction, and redundancy removal together", () => {
    const original = [
      dependency([attributeA, attributeB], [attributeC, attributeD]),
      dependency([attributeA], [attributeB]),
      dependency([attributeC], [attributeD]),
      dependency([attributeA], [attributeD]),
    ];
    const cover = findMinimalCover(
      relation(attributeA, attributeB, attributeC, attributeD),
      original,
    );

    expect(coverIds(cover)).toEqual([
      [["a"], ["b"]],
      [["a"], ["c"]],
      [["c"], ["d"]],
    ]);
    expectEquivalent(original, cover);
  });

  it("deduplicates mathematically identical dependencies", () => {
    const repeated = dependency([attributeA], [attributeB]);
    const cover = findMinimalCover(
      relation(attributeA, attributeB),
      [repeated, repeated, dependency([attributeA], [attributeB])],
    );

    expect(coverIds(cover)).toEqual([[["a"], ["b"]]]);
  });

  it("removes trivial dependencies as redundant", () => {
    const original = [dependency([attributeA, attributeB], [attributeA])];
    const cover = findMinimalCover(relation(attributeA, attributeB), original);

    expect(cover).toEqual([]);
    expectEquivalent(original, cover);
  });

  it("supports an empty LHS", () => {
    const original = [
      dependency([], [attributeA]),
      dependency([attributeA], [attributeB]),
    ];
    const cover = findMinimalCover(relation(attributeA, attributeB), original);

    expect(coverIds(cover)).toEqual([
      [[], ["a"]],
      [[], ["b"]],
    ]);
    expectEquivalent(original, cover);
  });

  it("discards an empty RHS because it imposes no constraint", () => {
    const original = [dependency([attributeA], [])];
    const cover = findMinimalCover(relation(attributeA), original);

    expect(cover).toEqual([]);
    expectEquivalent(original, cover);
  });

  it("terminates on cycles and preserves their equivalence", () => {
    const original = [
      dependency([attributeA], [attributeB]),
      dependency([attributeB], [attributeA]),
    ];
    const cover = findMinimalCover(relation(attributeA, attributeB), original);

    expect(coverIds(cover)).toEqual([
      [["a"], ["b"]],
      [["b"], ["a"]],
    ]);
    expectEquivalent(original, cover);
  });

  it("rejects identity collisions", () => {
    const conflictingA = Attribute.create("a", "Account number");

    expect(() => findMinimalCover(
      relation(attributeA, attributeB),
      [dependency([conflictingA], [attributeB])],
    )).toThrow(/Attribute identity conflict/);
  });

  it("rejects dependencies outside the relation scope", () => {
    expect(() => findMinimalCover(
      relation(attributeA, attributeB),
      [dependency([attributeA], [attributeC])],
    )).toThrow(/Functional dependency RHS.*external attribute ids: c/);
  });

  it("returns the same canonical order for every input order", () => {
    const original = [
      dependency([attributeC], [attributeD]),
      dependency([attributeA, attributeB], [attributeC]),
      dependency([attributeA], [attributeB]),
    ];
    const schema = relation(attributeD, attributeC, attributeB, attributeA);

    expect(coverIds(findMinimalCover(schema, [...original].reverse()))).toEqual(
      coverIds(findMinimalCover(schema, original)),
    );
    expect(coverIds(findMinimalCover(schema, original))).toEqual([
      [["a"], ["b"]],
      [["a"], ["c"]],
      [["c"], ["d"]],
    ]);
  });

  it("does not mutate the relation, dependencies, or source attribute sets", () => {
    const schemaAttributes = attributes(attributeD, attributeA, attributeC, attributeB);
    const schema = Relation.create("R", schemaAttributes);
    const left = attributes(attributeB, attributeA);
    const right = attributes(attributeD, attributeC);
    const original = [FunctionalDependency.create(left, right)];
    const relationBefore = schema.attributes.toArray();
    const leftBefore = left.toArray();
    const rightBefore = right.toArray();

    findMinimalCover(schema, original);

    expect(schema.attributes.toArray()).toEqual(relationBefore);
    expect(schemaAttributes.toArray()).toEqual(relationBefore);
    expect(left.toArray()).toEqual(leftBefore);
    expect(right.toArray()).toEqual(rightBefore);
    expect(original[0]?.left).toBe(left);
    expect(original[0]?.right).toBe(right);
  });

  it("returns a structurally minimal cover", () => {
    const original = [
      dependency([attributeA, attributeB], [attributeC, attributeD]),
      dependency([attributeA], [attributeB]),
      dependency([attributeC], [attributeD]),
      dependency([attributeA], [attributeD]),
    ];
    const cover = findMinimalCover(
      relation(attributeA, attributeB, attributeC, attributeD),
      original,
    );

    for (const [dependencyIndex, current] of cover.entries()) {
      expect(current.right.size).toBe(1);
      const rightAttribute = current.right.toArray()[0];
      expect(rightAttribute).toBeDefined();
      if (rightAttribute === undefined) {
        continue;
      }

      for (const leftAttribute of current.left.toArray()) {
        const reducedLeft = current.left.difference(attributes(leftAttribute));
        expect(attributeClosure(reducedLeft, cover).has(rightAttribute)).toBe(false);
      }

      const remaining = cover.filter((_, index) => index !== dependencyIndex);
      expect(attributeClosure(current.left, remaining).has(rightAttribute)).toBe(false);
    }
  });
});
