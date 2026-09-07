import { describe, expect, it } from "vitest";
import {
  Attribute,
  AttributeSet,
  FunctionalDependency,
  isSuperkey,
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

describe("isSuperkey", () => {
  it("detects a simple superkey through a transitive closure", () => {
    expect(isSuperkey(
      attributes(attributeA),
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB]), dependency([attributeB], [attributeC])],
    )).toBe(true);
  });

  it("rejects a set whose closure does not cover the relation", () => {
    expect(isSuperkey(
      attributes(attributeA),
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA], [attributeB])],
    )).toBe(false);
  });

  it("detects a composite superkey", () => {
    expect(isSuperkey(
      attributes(attributeA, attributeB),
      relation(attributeA, attributeB, attributeC, attributeD),
      [dependency([attributeA, attributeB], [attributeC]), dependency([attributeC], [attributeD])],
    )).toBe(true);
  });

  it("rejects a proper part of a composite superkey", () => {
    expect(isSuperkey(
      attributes(attributeA),
      relation(attributeA, attributeB, attributeC),
      [dependency([attributeA, attributeB], [attributeC])],
    )).toBe(false);
  });

  it("accepts a set that already contains the whole relation", () => {
    expect(isSuperkey(attributes(attributeA, attributeB, attributeC), relation(attributeA, attributeB, attributeC), [])).toBe(true);
  });

  it("accepts supersets of a superkey within the relation", () => {
    const dependencies = [dependency([attributeA], [attributeB]), dependency([attributeB], [attributeC])];

    expect(isSuperkey(attributes(attributeA), relation(attributeA, attributeB, attributeC), dependencies)).toBe(true);
    expect(isSuperkey(attributes(attributeA, attributeB), relation(attributeA, attributeB, attributeC), dependencies)).toBe(true);
  });

  it("handles a single-attribute relation", () => {
    expect(isSuperkey(attributes(attributeA), relation(attributeA), [])).toBe(true);
  });

  it("handles empty input and an empty-LHS dependency", () => {
    expect(isSuperkey(attributes(), relation(attributeA), [dependency([], [attributeA])])).toBe(true);
    expect(isSuperkey(attributes(), relation(attributeA, attributeB), [dependency([], [attributeA])])).toBe(false);
  });

  it("rejects input attributes outside the relation", () => {
    expect(() => isSuperkey(
      attributes(attributeC),
      relation(attributeA, attributeB),
      [],
    )).toThrow(/Input attributes.*external attribute ids: c/);
  });

  it("rejects a functional dependency RHS outside the relation", () => {
    expect(() => isSuperkey(
      attributes(attributeA),
      relation(attributeA, attributeB),
      [dependency([attributeA], [attributeC])],
    )).toThrow(/Functional dependency RHS.*external attribute ids: c/);
  });

  it("rejects a functional dependency LHS outside the relation", () => {
    expect(() => isSuperkey(
      attributes(attributeA),
      relation(attributeA, attributeB),
      [dependency([attributeC], [attributeA])],
    )).toThrow(/Functional dependency LHS.*external attribute ids: c/);
  });

  it("continues to evaluate fully in-scope inputs normally", () => {
    expect(isSuperkey(
      attributes(attributeA),
      relation(attributeA, attributeB),
      [dependency([attributeA], [attributeB])],
    )).toBe(true);
  });

  it("handles trivial dependencies and cycles", () => {
    expect(isSuperkey(
      attributes(attributeA),
      relation(attributeA, attributeB),
      [dependency([attributeA], [attributeA]), dependency([attributeA], [attributeB]), dependency([attributeB], [attributeA])],
    )).toBe(true);
  });

  it("preserves the domain identity-conflict policy", () => {
    const conflictingA = Attribute.create("a", "Account number");

    expect(() => isSuperkey(
      attributes(attributeA),
      relation(attributeA, attributeB),
      [dependency([conflictingA], [attributeB])],
    )).toThrow(/Attribute identity conflict/);
  });
});
