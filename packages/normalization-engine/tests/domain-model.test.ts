import { describe, expect, it } from "vitest";
import {
  Attribute,
  AttributeSet,
  FunctionalDependency,
  Relation,
} from "../src/index.js";

const attributeA = Attribute.create("a", "A");
const attributeB = Attribute.create("b", "B");
const attributeC = Attribute.create("c", "C");

describe("Attribute", () => {
  it("keeps internal identity separate from visible name", () => {
    const renamed = Attribute.create("a", "Account number");
    const sameName = Attribute.create("different-id", "A");

    expect(attributeA.equals(renamed)).toBe(true);
    expect(attributeA.name).toBe("A");
    expect(attributeA.equals(sameName)).toBe(false);
  });

  it("rejects blank identity and names", () => {
    expect(() => Attribute.create(" ", "A")).toThrow();
    expect(() => Attribute.create("a", " ")).toThrow();
  });
});

describe("AttributeSet", () => {
  it("removes compatible duplicate identities and supports set operations", () => {
    const equivalentA = Attribute.create("a", "A");
    const left = new AttributeSet([attributeA, attributeB, equivalentA]);
    const right = new AttributeSet([attributeB, attributeC]);

    expect(left.size).toBe(2);
    expect(left.has(attributeA)).toBe(true);
    expect(left.has(attributeC)).toBe(false);
    expect(left.equals(new AttributeSet([attributeB, attributeA]))).toBe(true);
    expect(new AttributeSet([attributeA]).isSubsetOf(left)).toBe(true);
    expect(left.union(right).equals(new AttributeSet([attributeA, attributeB, attributeC]))).toBe(true);
    expect(left.difference(right).equals(new AttributeSet([attributeA]))).toBe(true);
  });

  it("rejects attributes with the same identity and different visible names", () => {
    const conflictingA = Attribute.create("a", "Account number");

    expect(() => new AttributeSet([attributeA, conflictingA])).toThrow(
      /Attribute identity conflict/,
    );
    expect(() => new AttributeSet([attributeA]).union(new AttributeSet([conflictingA]))).toThrow(
      /Attribute identity conflict/,
    );
  });

  it("does not expose a mutable backing collection", () => {
    const set = new AttributeSet([attributeA]);
    const exported = set.toArray();

    expect(() => (exported as Attribute[]).push(attributeB)).not.toThrow();
    expect(set.size).toBe(1);
    expect(set.has(attributeB)).toBe(false);
  });
});

describe("Relation", () => {
  it("creates a named relation with attributes", () => {
    const relation = Relation.create("R", new AttributeSet([attributeA, attributeB]));

    expect(relation.name).toBe("R");
    expect(relation.attributes.has(attributeA)).toBe(true);
  });

  it("rejects blank names and empty schemas", () => {
    expect(() => Relation.create(" ", new AttributeSet([attributeA]))).toThrow();
    expect(() => Relation.create("R", new AttributeSet())).toThrow();
  });
});

describe("FunctionalDependency", () => {
  it("creates simple and composite dependencies", () => {
    const simple = FunctionalDependency.create(
      new AttributeSet([attributeA]),
      new AttributeSet([attributeB]),
    );
    const composite = FunctionalDependency.create(
      new AttributeSet([attributeA, attributeB]),
      new AttributeSet([attributeC, attributeB]),
    );

    expect(simple.left.equals(new AttributeSet([attributeA]))).toBe(true);
    expect(simple.right.equals(new AttributeSet([attributeB]))).toBe(true);
    expect(composite.left.size).toBe(2);
    expect(composite.right.size).toBe(2);
  });
});
