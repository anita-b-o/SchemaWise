import { describe, expect, it } from "vitest";
import {
  Attribute,
  AttributeSet,
  findPrimeAttributes,
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

function attributeIds(value: AttributeSet): string[] {
  return value.toArray().map(({ id }) => id);
}

describe("findPrimeAttributes", () => {
  it("returns the sole simple candidate key attribute", () => {
    const primeAttributes = findPrimeAttributes(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB]), dependency([attributeB], [attributeC])],
    );

    expect(attributeIds(primeAttributes)).toEqual(["a"]);
  });

  it("returns every attribute of a composite candidate key", () => {
    const primeAttributes = findPrimeAttributes(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB])],
    );

    expect(attributeIds(primeAttributes)).toEqual(["a", "c"]);
  });

  it("unites attributes from multiple candidate keys", () => {
    const primeAttributes = findPrimeAttributes(
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB]), dependency([attributeB], [attributeA])],
    );

    expect(attributeIds(primeAttributes)).toEqual(["a", "b", "c"]);
  });

  it("excludes attributes that belong to no candidate key", () => {
    const primeAttributes = findPrimeAttributes(
      relation(attributeA, attributeB, attributeC, attributeD),
      [
        dependency([attributeA], [attributeB]),
        dependency([attributeB], [attributeC]),
      ],
    );

    expect(attributeIds(primeAttributes)).toEqual(["a", "d"]);
    expect(primeAttributes.has(attributeB)).toBe(false);
    expect(primeAttributes.has(attributeC)).toBe(false);
  });

  it("returns an empty AttributeSet when the candidate key is empty", () => {
    const primeAttributes = findPrimeAttributes(
      relation(attributeA, attributeB),
      [dependency([], [attributeA]), dependency([attributeA], [attributeB])],
    );

    expect(primeAttributes).toBeInstanceOf(AttributeSet);
    expect(primeAttributes.size).toBe(0);
  });

  it("returns every relation attribute when the full relation is the candidate key", () => {
    const primeAttributes = findPrimeAttributes(
      relation(attributeA, attributeB, attributeC),
      [],
    );

    expect(attributeIds(primeAttributes)).toEqual(["a", "b", "c"]);
  });

  it("unites candidate keys of different cardinalities", () => {
    const primeAttributes = findPrimeAttributes(
      relation(attributeA, attributeB, attributeC),
      [
        dependency([attributeA], [attributeB, attributeC]),
        dependency([attributeB, attributeC], [attributeA]),
      ],
    );

    expect(attributeIds(primeAttributes)).toEqual(["a", "b", "c"]);
  });

  it("is mathematically independent of relation and dependency order", () => {
    const dependencies = [
      dependency([attributeA], [attributeB]),
      dependency([attributeB], [attributeA]),
      dependency([attributeC], [attributeD]),
      dependency([attributeD], [attributeC]),
    ];
    const forward = findPrimeAttributes(
      relation(attributeA, attributeB, attributeC, attributeD),
      dependencies,
    );
    const reordered = findPrimeAttributes(
      relation(attributeD, attributeB, attributeA, attributeC),
      [...dependencies].reverse(),
    );

    expect(attributeIds(reordered)).toEqual(attributeIds(forward));
    expect(attributeIds(forward)).toEqual(["a", "b", "c", "d"]);
  });

  it("propagates relation-scope validation", () => {
    expect(() => findPrimeAttributes(
      relation(attributeA, attributeB),
      [dependency([attributeA], [attributeC])],
    )).toThrow(/Functional dependency RHS.*external attribute ids: c/);
  });

  it("preserves the domain identity-conflict policy", () => {
    const conflictingA = Attribute.create("a", "Account number");

    expect(() => findPrimeAttributes(
      relation(attributeA, attributeB),
      [dependency([conflictingA], [attributeB])],
    )).toThrow(/Attribute identity conflict/);
  });

  it("does not mutate the relation, dependencies, or their attribute sets", () => {
    const schemaAttributes = attributes(attributeD, attributeA, attributeC, attributeB);
    const schema = Relation.create("R", schemaAttributes);
    const dependencies = [dependency([attributeA], [attributeB])];
    const relationBefore = schema.attributes.toArray();
    const dependenciesBefore = dependencies.map(({ left, right }) => ({
      left: left.toArray(),
      right: right.toArray(),
    }));

    const primeAttributes = findPrimeAttributes(schema, dependencies);

    expect(attributeIds(primeAttributes)).toEqual(["a", "c", "d"]);
    expect(schema.attributes.toArray()).toEqual(relationBefore);
    expect(schemaAttributes.toArray()).toEqual(relationBefore);
    expect(dependencies.map(({ left, right }) => ({ left: left.toArray(), right: right.toArray() }))).toEqual(
      dependenciesBefore,
    );
  });
});
