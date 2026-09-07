import { describe, expect, it } from "vitest";
import {
  Attribute,
  AttributeSet,
  findCandidateKeys,
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

function relation(...values: Attribute[]): Relation {
  return Relation.create("R", attributes(...values));
}

function dependency(left: Attribute[], right: Attribute[]): FunctionalDependency {
  return FunctionalDependency.create(attributes(...left), attributes(...right));
}

function keyIds(keys: readonly AttributeSet[]): string[] {
  return keys.map((key) => key.toArray().map(({ id }) => id).join(""));
}

describe("findCandidateKeys", () => {
  it("finds a simple key through a transitive closure", () => {
    const keys = findCandidateKeys(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB]), dependency([attributeB], [attributeC])],
    );

    expect(keyIds(keys)).toEqual(["a"]);
  });

  it("finds a composite key containing an underivable attribute", () => {
    const keys = findCandidateKeys(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB])],
    );

    expect(keyIds(keys)).toEqual(["ac"]);
  });

  it("finds multiple candidate keys", () => {
    const keys = findCandidateKeys(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB]), dependency([attributeB], [attributeA])],
    );

    expect(keyIds(keys)).toEqual(["ac", "bc"]);
  });

  it("requires all relation attributes when there are no dependencies", () => {
    expect(keyIds(findCandidateKeys(relation(attributeA, attributeB, attributeC), []))).toEqual(["abc"]);
  });

  it("allows the empty set to be a candidate key", () => {
    const keys = findCandidateKeys(
      relation(attributeA, attributeB),
      [dependency([], [attributeA]), dependency([attributeA], [attributeB])],
    );

    expect(keyIds(keys)).toEqual([""]);
    expect(keys[0]?.size).toBe(0);
  });

  it("excludes non-minimal superkeys", () => {
    const keys = findCandidateKeys(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB]), dependency([attributeA], [attributeC])],
    );

    expect(keyIds(keys)).toEqual(["a"]);
  });

  it("finds inclusion-minimal keys of different cardinalities", () => {
    const keys = findCandidateKeys(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB, attributeC]), dependency([attributeB, attributeC], [attributeA])],
    );

    expect(keyIds(keys)).toEqual(["a", "bc"]);
  });

  it("is unaffected by redundant dependencies", () => {
    const base = [dependency([attributeA], [attributeB]), dependency([attributeB], [attributeC])];
    const redundant = [...base, dependency([attributeA], [attributeC])];
    const schema = relation(attributeA, attributeB, attributeC);

    expect(keyIds(findCandidateKeys(schema, redundant))).toEqual(keyIds(findCandidateKeys(schema, base)));
  });

  it("terminates for cyclic dependencies", () => {
    const keys = findCandidateKeys(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB]), dependency([attributeB], [attributeA])],
    );

    expect(keyIds(keys)).toEqual(["ac", "bc"]);
  });

  it("returns a deterministic order independent of relation and dependency order", () => {
    const forwardDependencies = [
      dependency([attributeA], [attributeB]),
      dependency([attributeB], [attributeA]),
      dependency([attributeC], [attributeD]),
      dependency([attributeD], [attributeC]),
    ];
    const forward = findCandidateKeys(
      relation(attributeA, attributeB, attributeC, attributeD),
      forwardDependencies,
    );
    const reordered = findCandidateKeys(
      relation(attributeD, attributeB, attributeA, attributeC),
      [...forwardDependencies].reverse(),
    );

    expect(keyIds(forward)).toEqual(["ac", "ad", "bc", "bd"]);
    expect(keyIds(reordered)).toEqual(keyIds(forward));
  });

  it("rejects a functional dependency LHS outside the relation", () => {
    expect(() => findCandidateKeys(
      relation(attributeA, attributeB),
      [dependency([attributeC], [attributeA])],
    )).toThrow(/Functional dependency LHS.*external attribute ids: c/);
  });

  it("rejects a functional dependency RHS outside the relation", () => {
    expect(() => findCandidateKeys(
      relation(attributeA, attributeB),
      [dependency([attributeA], [attributeC])],
    )).toThrow(/Functional dependency RHS.*external attribute ids: c/);
  });

  it("preserves the domain identity-conflict policy", () => {
    const conflictingA = Attribute.create("a", "Account number");

    expect(() => findCandidateKeys(
      relation(attributeA, attributeB),
      [dependency([conflictingA], [attributeB])],
    )).toThrow(/Attribute identity conflict/);
  });

  it("does not mutate the relation, dependencies, or their attribute sets", () => {
    const schemaAttributes = attributes(attributeC, attributeA, attributeB);
    const schema = Relation.create("R", schemaAttributes);
    const dependencies = [dependency([attributeA], [attributeB])];
    const relationBefore = schema.attributes.toArray();
    const dependenciesBefore = dependencies.map(({ left, right }) => ({
      left: left.toArray(),
      right: right.toArray(),
    }));

    findCandidateKeys(schema, dependencies);

    expect(schema.attributes.toArray()).toEqual(relationBefore);
    expect(schemaAttributes.toArray()).toEqual(relationBefore);
    expect(dependencies.map(({ left, right }) => ({ left: left.toArray(), right: right.toArray() }))).toEqual(
      dependenciesBefore,
    );
  });
});
