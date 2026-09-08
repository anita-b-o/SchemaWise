import { describe, expect, it } from "vitest";
import {
  analyzeBoyceCoddNormalForm,
  analyzeDependencyPreservation,
  analyzeSecondNormalForm,
  analyzeThirdNormalForm,
  attributeClosure,
  Attribute,
  AttributeSet,
  decomposeToBoyceCoddNormalForm,
  findCandidateKeys,
  findMinimalCover,
  findPrimeAttributes,
  FunctionalDependency,
  isSuperkey,
  projectFunctionalDependencies,
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

function setIds(values: readonly AttributeSet[]): string[] {
  return values.map((value) => value.toArray().map(({ id }) => id).join(""));
}

function smallDependencyFamilies(): readonly FunctionalDependency[][] {
  const atoms = [
    fd([a], [b]), fd([b], [a]),
    fd([b], [c]), fd([c], [b]),
    fd([a, b], [c]), fd([a, c], [b]), fd([b, c], [a]),
    fd([], [a]),
  ];
  return Array.from({ length: 2 ** atoms.length }, (_, mask) =>
    atoms.filter((_, index) => (mask & (1 << index)) !== 0)
  );
}

describe("normalization engine mathematical consistency", () => {
  it("exhaustively enforces the normal-form hierarchy over small FD families", () => {
    const schema = relation(a, b, c);

    for (const dependencies of smallDependencyFamilies()) {
      const second = analyzeSecondNormalForm(schema, dependencies);
      const third = analyzeThirdNormalForm(schema, dependencies);
      const bcnf = analyzeBoyceCoddNormalForm(schema, dependencies);

      if (bcnf.satisfied) {
        expect(third.satisfied).toBe(true);
      }
      if (third.satisfied) {
        expect(second.satisfied).toBe(true);
      }
    }
  });

  it("finds exactly the inclusion-minimal superkeys and derives prime attributes", () => {
    const schema = relation(a, b, c);
    const allSubsets = subsets(schema.attributes);

    for (const dependencies of smallDependencyFamilies()) {
      const expectedKeys = allSubsets.filter((candidate) =>
        isSuperkey(candidate, schema, dependencies)
        && !allSubsets.some((properSubset) =>
          properSubset.size < candidate.size
          && properSubset.isSubsetOf(candidate)
          && isSuperkey(properSubset, schema, dependencies)
        )
      ).sort((left, right) =>
        left.size - right.size
        || setIds([left])[0]!.localeCompare(setIds([right])[0]!)
      );
      const actualKeys = findCandidateKeys(schema, dependencies);

      expect(setIds(actualKeys)).toEqual(setIds(expectedKeys));
      for (const key of actualKeys) {
        expect(isSuperkey(key, schema, dependencies)).toBe(true);
        for (const properSubset of subsets(key).filter(({ size }) => size < key.size)) {
          expect(isSuperkey(properSubset, schema, dependencies)).toBe(false);
        }
      }

      const expectedPrime = actualKeys.reduce(
        (union, key) => union.union(key),
        set(),
      );
      expect(findPrimeAttributes(schema, dependencies).equals(expectedPrime)).toBe(true);
    }
  });

  it("covers adversarial key cardinalities and empty determinants", () => {
    const schema = relation(a, b, c);
    expect(setIds(findCandidateKeys(
      schema,
      [fd([a], [b, c]), fd([b, c], [a])],
    ))).toEqual(["a", "bc"]);
    expect(setIds(findCandidateKeys(schema, [fd([], [a, b, c])]))).toEqual([""]);

    const second = analyzeSecondNormalForm(schema, [fd([], [c])]);
    expect(second.satisfied).toBe(false);
    expect(second.violations.some(({ candidateKey, determinant, dependent }) =>
      candidateKey.equals(set(a, b))
      && determinant.size === 0
      && dependent.equals(c)
    )).toBe(true);
  });

  it("keeps every minimal cover equivalent and structurally minimal", () => {
    const schema = relation(a, b, c);

    for (const dependencies of smallDependencyFamilies()) {
      const cover = findMinimalCover(schema, dependencies);

      for (const determinant of subsets(schema.attributes)) {
        expect(attributeClosure(determinant, cover).equals(
          attributeClosure(determinant, dependencies),
        )).toBe(true);
      }

      for (const [index, dependency] of cover.entries()) {
        expect(dependency.right.size).toBe(1);
        const dependent = dependency.right.toArray()[0];
        expect(dependent).toBeDefined();
        if (dependent === undefined) {
          continue;
        }
        for (const attribute of dependency.left.toArray()) {
          const reduced = dependency.left.difference(set(attribute));
          expect(attributeClosure(reduced, cover).has(dependent)).toBe(false);
        }
        const remaining = cover.filter((_, dependencyIndex) => dependencyIndex !== index);
        expect(attributeClosure(dependency.left, remaining).has(dependent)).toBe(false);
      }
    }
  });

  it("preserves every restricted closure under FD projection", () => {
    const cases = [
      {
        schema: relation(a, b, c, d),
        dependencies: [fd([a], [b]), fd([b], [c]), fd([c], [a]), fd([a, c], [d])],
      },
      {
        schema: relation(a, b, c),
        dependencies: [fd([], [a]), fd([a], [b]), fd([a, c], [b]), fd([b], [])],
      },
    ];

    for (const { schema, dependencies } of cases) {
      for (const target of subsets(schema.attributes)) {
        const projection = projectFunctionalDependencies(schema, dependencies, target);
        for (const determinant of subsets(target)) {
          const restricted = intersection(attributeClosure(determinant, dependencies), target);
          expect(attributeClosure(determinant, projection).equals(restricted)).toBe(true);
        }
      }
    }
  });

  it("produces dependency-preserving 3NF relations with a key-containing schema", () => {
    const cases = [
      [relation(a, b, c, d), [fd([a], [b]), fd([b], [a]), fd([c], [d])]],
      [relation(a, b, c), [fd([a], [b, c]), fd([b, c], [a])]],
      [relation(a, b, c), [fd([], [a]), fd([a], [b])]],
      [relation(a, b, c), []],
    ] as const;

    for (const [schema, dependencies] of cases) {
      const synthesis = synthesizeThirdNormalForm(schema, dependencies);
      const decomposition = synthesis.relations.map(({ attributes }) => attributes);

      expect(analyzeDependencyPreservation(schema, dependencies, decomposition).preserved)
        .toBe(true);
      expect(decomposition.some((attributes) =>
        findCandidateKeys(schema, dependencies).some((key) => key.isSubsetOf(attributes))
      )).toBe(true);

      for (const attributes of decomposition) {
        const projection = projectFunctionalDependencies(schema, dependencies, attributes);
        expect(analyzeThirdNormalForm(
          Relation.create("synthesized", attributes),
          projection,
        ).satisfied).toBe(true);
      }
    }
  });

  it("produces BCNF leaves through lossless binary steps", () => {
    const cases = [
      [relation(a, b, c, d), [fd([a], [b]), fd([b], [c]), fd([c], [d])]],
      [relation(a, b, c), [fd([a, b], [c]), fd([c], [b])]],
      [relation(a, b, c), [fd([], [a])]],
      [relation(a, b, c), []],
    ] as const;

    for (const [schema, dependencies] of cases) {
      const decomposition = decomposeToBoyceCoddNormalForm(schema, dependencies);

      for (const leaf of decomposition.relations) {
        const projection = projectFunctionalDependencies(schema, dependencies, leaf.attributes);
        expect(analyzeBoyceCoddNormalForm(
          Relation.create("leaf", leaf.attributes),
          projection,
        ).satisfied).toBe(true);
      }

      for (const step of decomposition.steps) {
        const [left, right] = step.result;
        const common = intersection(left, right);
        const parentProjection = projectFunctionalDependencies(
          schema,
          dependencies,
          step.source,
        );
        expect(left.union(right).equals(step.source)).toBe(true);
        expect(common.equals(step.violation.determinant)).toBe(true);
        expect(left.isSubsetOf(attributeClosure(common, parentProjection))).toBe(true);
      }
    }
  });

  it("retains the strict 3NF/BCNF distinction and detects BCNF dependency loss", () => {
    const schema = relation(a, b, c);
    const dependencies = [fd([a, b], [c]), fd([c], [b])];

    expect(analyzeThirdNormalForm(schema, dependencies).satisfied).toBe(true);
    expect(analyzeBoyceCoddNormalForm(schema, dependencies).satisfied).toBe(false);

    const decomposition = decomposeToBoyceCoddNormalForm(schema, dependencies);
    expect(analyzeDependencyPreservation(
      schema,
      dependencies,
      decomposition.relations.map(({ attributes }) => attributes),
    ).preserved).toBe(false);
  });
});
