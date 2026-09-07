import { describe, expect, it } from "vitest";
import {
  attributeClosure,
  Attribute,
  AttributeSet,
  FunctionalDependency,
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

describe("attributeClosure", () => {
  it("derives the base example through repeated application", () => {
    const dependencies = [
      dependency([attributeA], [attributeB]),
      dependency([attributeB], [attributeC]),
      dependency([attributeA, attributeC], [attributeD]),
    ];

    expect(attributeClosure(attributes(attributeA), dependencies).equals(
      attributes(attributeA, attributeB, attributeC, attributeD),
    )).toBe(true);
  });

  it("leaves attributes unchanged when no dependency applies", () => {
    expect(attributeClosure(attributes(attributeC), [dependency([attributeA], [attributeB])]).equals(
      attributes(attributeC),
    )).toBe(true);
  });

  it("follows transitive chains", () => {
    const dependencies = [
      dependency([attributeA], [attributeB]),
      dependency([attributeB], [attributeC]),
      dependency([attributeC], [attributeD]),
    ];

    expect(attributeClosure(attributes(attributeA), dependencies).equals(
      attributes(attributeA, attributeB, attributeC, attributeD),
    )).toBe(true);
  });

  it("requires every attribute of a composite determinant", () => {
    const dependencies = [
      dependency([attributeA, attributeB], [attributeC]),
      dependency([attributeC], [attributeD]),
    ];

    expect(attributeClosure(attributes(attributeA), dependencies).equals(attributes(attributeA))).toBe(true);
    expect(attributeClosure(attributes(attributeA, attributeB), dependencies).equals(
      attributes(attributeA, attributeB, attributeC, attributeD),
    )).toBe(true);
  });

  it("terminates for cyclic dependencies", () => {
    expect(attributeClosure(attributes(attributeA), [
      dependency([attributeA], [attributeB]),
      dependency([attributeB], [attributeA]),
    ]).equals(attributes(attributeA, attributeB))).toBe(true);
  });

  it("handles trivial dependencies without expanding the closure", () => {
    expect(attributeClosure(attributes(attributeA), [dependency([attributeA], [attributeA])]).equals(
      attributes(attributeA),
    )).toBe(true);
  });

  it("adds every attribute on a multiple-attribute RHS", () => {
    expect(attributeClosure(attributes(attributeA), [dependency([attributeA], [attributeB, attributeC])]).equals(
      attributes(attributeA, attributeB, attributeC),
    )).toBe(true);
  });

  it("applies an empty LHS to every closure", () => {
    expect(attributeClosure(attributes(attributeB), [dependency([], [attributeA])]).equals(
      attributes(attributeA, attributeB),
    )).toBe(true);
  });

  it("does not expand the closure for an empty RHS", () => {
    expect(attributeClosure(attributes(attributeA), [dependency([attributeA], [])]).equals(
      attributes(attributeA),
    )).toBe(true);
  });

  it("supports empty input with and without applicable empty-LHS dependencies", () => {
    expect(attributeClosure(attributes(), []).equals(attributes())).toBe(true);
    expect(attributeClosure(attributes(), [dependency([], [attributeA])]).equals(
      attributes(attributeA),
    )).toBe(true);
  });

  it("does not mutate its input or dependencies", () => {
    const input = attributes(attributeA);
    const dependencies = [dependency([attributeA], [attributeB])];
    const inputBefore = input.toArray();
    const dependencyBefore = dependencies.map(({ left, right }) => ({
      left: left.toArray(),
      right: right.toArray(),
    }));

    const result = attributeClosure(input, dependencies);

    expect(input.toArray()).toEqual(inputBefore);
    expect(dependencies.map(({ left, right }) => ({ left: left.toArray(), right: right.toArray() }))).toEqual(
      dependencyBefore,
    );
    expect(result.equals(attributes(attributeA, attributeB))).toBe(true);
  });

  it("is independent of dependency order", () => {
    const dependencies = [
      dependency([attributeA], [attributeB]),
      dependency([attributeB], [attributeC]),
      dependency([attributeA, attributeC], [attributeD]),
    ];

    const forward = attributeClosure(attributes(attributeA), dependencies);
    const reversed = attributeClosure(attributes(attributeA), [...dependencies].reverse());

    expect(forward.equals(reversed)).toBe(true);
  });

  it("rejects conflicting identities across the closure operation", () => {
    const conflictingA = Attribute.create("a", "Account number");

    expect(() => attributeClosure(
      attributes(attributeA),
      [dependency([conflictingA], [attributeB])],
    )).toThrow(/Attribute identity conflict/);
  });
});
