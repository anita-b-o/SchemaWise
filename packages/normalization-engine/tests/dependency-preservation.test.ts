import { describe, expect, it } from "vitest";
import {
  analyzeBoyceCoddNormalForm,
  analyzeDependencyPreservation,
  attributeClosure,
  Attribute,
  AttributeSet,
  decomposeToBoyceCoddNormalForm,
  FunctionalDependency,
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

function dependencyIds(dependencies: readonly FunctionalDependency[]) {
  return dependencies.map((dependency) => ({
    left: dependency.left.toArray().map(({ id }) => id),
    right: dependency.right.toArray().map(({ id }) => id),
  }));
}

describe("analyzeDependencyPreservation", () => {
  it("confirms dependency preservation for a real 3NF synthesis", () => {
    const schema = relation(a, b, c, d);
    const dependencies = [fd([a], [b]), fd([b, c], [a]), fd([c], [d])];
    const synthesis = synthesizeThirdNormalForm(schema, dependencies);

    const analysis = analyzeDependencyPreservation(
      schema,
      dependencies,
      synthesis.relations.map(({ attributes }) => attributes),
    );

    expect(analysis.preserved).toBe(true);
    expect(analysis.lostDependencies).toEqual([]);
    expect(dependencyIds(analysis.preservedDependencies)).toEqual(
      dependencyIds(synthesis.minimalCover),
    );
  });

  it("confirms a dependency-preserving BCNF decomposition", () => {
    const schema = relation(a, b, c);
    const dependencies = [fd([a], [b]), fd([b], [c])];
    const decomposition = decomposeToBoyceCoddNormalForm(schema, dependencies);
    const analysis = analyzeDependencyPreservation(
      schema,
      dependencies,
      decomposition.relations.map(({ attributes }) => attributes),
    );

    expect(analysis.preserved).toBe(true);
    expect(analysis.lostDependencies).toEqual([]);
  });

  it("detects a lossless BCNF decomposition that loses AB -> C", () => {
    const schema = relation(a, b, c);
    const dependencies = [fd([a, b], [c]), fd([c], [b])];
    const decomposition = decomposeToBoyceCoddNormalForm(schema, dependencies);

    expect(decomposition.relations.map(({ attributes }) =>
      attributes.toArray().map(({ id }) => id)
    )).toEqual([["a", "c"], ["b", "c"]]);

    for (const leaf of decomposition.relations) {
      const projection = projectFunctionalDependencies(schema, dependencies, leaf.attributes);
      expect(analyzeBoyceCoddNormalForm(
        Relation.create("leaf", leaf.attributes),
        projection,
      ).satisfied).toBe(true);
    }

    expect(decomposition.steps).toHaveLength(1);
    const step = decomposition.steps[0];
    expect(step).toBeDefined();
    if (step !== undefined) {
      const [left, right] = step.result;
      expect(left.union(right).equals(step.source)).toBe(true);
      expect(intersection(left, right).equals(step.violation.determinant)).toBe(true);
      expect(attributeClosure(step.violation.determinant, dependencies)
        .has(step.violation.dependent)).toBe(true);
    }

    const analysis = analyzeDependencyPreservation(
      schema,
      dependencies,
      decomposition.relations.map(({ attributes }) => attributes),
    );
    expect(analysis.preserved).toBe(false);
    expect(dependencyIds(analysis.lostDependencies)).toEqual([
      { left: ["a", "b"], right: ["c"] },
    ]);
  });

  it("uses transitive implication across the union of local projections", () => {
    const schema = relation(a, b, c);
    const dependencies = [fd([a], [c]), fd([c], [b]), fd([b], [c])];
    const decomposition = [set(a, b), set(b, c)];
    const projections = decomposition.map((attributes) =>
      projectFunctionalDependencies(schema, dependencies, attributes)
    );

    expect(projections.every((projection) =>
      !projection.some((dependency) =>
        dependency.left.equals(set(a)) && dependency.right.equals(set(c))
      )
    )).toBe(true);
    expect(dependencyIds(projections[0] ?? [])).toContainEqual({
      left: ["a"], right: ["b"],
    });
    expect(dependencyIds(projections[1] ?? [])).toContainEqual({
      left: ["b"], right: ["c"],
    });

    const analysis = analyzeDependencyPreservation(schema, dependencies, decomposition);
    expect(analysis.preserved).toBe(true);
    expect(dependencyIds(analysis.preservedDependencies)).toContainEqual({
      left: ["a"], right: ["c"],
    });
  });

  it("is unchanged by a redundant original dependency", () => {
    const schema = relation(a, b, c);
    const decomposition = [set(a, b), set(b, c)];
    const minimal = analyzeDependencyPreservation(
      schema, [fd([a], [b]), fd([b], [c])], decomposition,
    );
    const redundant = analyzeDependencyPreservation(
      schema, [fd([a], [b]), fd([b], [c]), fd([a], [c])], decomposition,
    );

    expect(redundant.preserved).toBe(minimal.preserved);
    expect(dependencyIds(redundant.lostDependencies)).toEqual(
      dependencyIds(minimal.lostDependencies),
    );
  });

  it("treats empty F as preserved for every valid covering decomposition", () => {
    const analysis = analyzeDependencyPreservation(
      relation(a, b, c), [], [set(a, b), set(c)],
    );

    expect(analysis).toEqual({
      preserved: true,
      preservedDependencies: [],
      lostDependencies: [],
    });
  });

  it("preserves every dependency when the decomposition is R itself", () => {
    const schema = relation(a, b, c);
    const dependencies = [fd([a], [b]), fd([b], [c])];
    const analysis = analyzeDependencyPreservation(
      schema, dependencies, [schema.attributes],
    );

    expect(analysis.preserved).toBe(true);
    expect(analysis.lostDependencies).toEqual([]);
  });

  it("ignores repeated subrelations", () => {
    const schema = relation(a, b, c);
    const dependencies = [fd([a], [b]), fd([b], [c])];
    const unique = analyzeDependencyPreservation(
      schema, dependencies, [set(a, b), set(b, c)],
    );
    const repeated = analyzeDependencyPreservation(
      schema, dependencies, [set(a, b), set(b, c), set(a, b)],
    );

    expect(dependencyIds(repeated.preservedDependencies)).toEqual(
      dependencyIds(unique.preservedDependencies),
    );
    expect(dependencyIds(repeated.lostDependencies)).toEqual(
      dependencyIds(unique.lostDependencies),
    );
  });

  it("is deterministic under FD, subrelation, and attribute reordering", () => {
    const schema = relation(d, c, b, a);
    const forward = analyzeDependencyPreservation(
      schema,
      [fd([c], [d]), fd([a, b], [c]), fd([a], [b])],
      [set(c, d), set(b, a), set(c, b)],
    );
    const reordered = analyzeDependencyPreservation(
      schema,
      [fd([a], [b]), fd([a, b], [c]), fd([c], [d])],
      [set(b, c), set(a, b), set(d, c)],
    );

    expect(dependencyIds(forward.preservedDependencies)).toEqual(
      dependencyIds(reordered.preservedDependencies),
    );
    expect(dependencyIds(forward.lostDependencies)).toEqual(
      dependencyIds(reordered.lostDependencies),
    );
    expect(dependencyIds(forward.preservedDependencies)).toEqual([
      { left: ["a"], right: ["b"] },
      { left: ["c"], right: ["d"] },
    ]);
    expect(dependencyIds(forward.lostDependencies)).toEqual([
      { left: ["a"], right: ["c"] },
    ]);
  });

  it("rejects a decomposition that does not cover R", () => {
    expect(() => analyzeDependencyPreservation(
      relation(a, b, c), [fd([a], [b])], [set(a, b)],
    )).toThrow(/decomposition must cover every attribute.*missing attribute ids: c/);
  });

  it("rejects a subrelation with an attribute outside R", () => {
    expect(() => analyzeDependencyPreservation(
      relation(a, b), [], [set(a, b), set(c)],
    )).toThrow(/Input attributes.*external attribute ids: c/);
  });

  it("preserves scope validation for original F", () => {
    expect(() => analyzeDependencyPreservation(
      relation(a, b), [fd([a], [c])], [set(a, b)],
    )).toThrow(/Functional dependency RHS.*external attribute ids: c/);
  });

  it("preserves identity-collision detection in F and the decomposition", () => {
    const conflictingA = Attribute.create("a", "Account number");

    expect(() => analyzeDependencyPreservation(
      relation(a, b), [fd([conflictingA], [b])], [set(a, b)],
    )).toThrow(/Attribute identity conflict/);
    expect(() => analyzeDependencyPreservation(
      relation(a, b), [], [set(conflictingA, b)],
    )).toThrow(/Attribute identity conflict/);
  });

  it("handles dependencies with an empty LHS", () => {
    const analysis = analyzeDependencyPreservation(
      relation(a, b, c),
      [fd([], [a]), fd([a], [b])],
      [set(a), set(a, b), set(c)],
    );

    expect(analysis.preserved).toBe(true);
    expect(dependencyIds(analysis.preservedDependencies)).toEqual([
      { left: [], right: ["a"] },
      { left: [], right: ["b"] },
    ]);
  });

  it("allows empty subrelations as mathematically inert entries", () => {
    const schema = relation(a, b);
    const analysis = analyzeDependencyPreservation(
      schema, [fd([a], [b])], [set(), schema.attributes],
    );

    expect(analysis.preserved).toBe(true);
  });

  it("does not mutate inputs and freezes every result structure", () => {
    const schemaAttributes = set(c, b, a);
    const schema = Relation.create("R", schemaAttributes);
    const left = set(a);
    const right = set(b);
    const dependency = FunctionalDependency.create(left, right);
    const dependencies = [dependency, fd([b], [c])];
    const decomposition = [set(b, a), set(c, b)];
    const relationBefore = schema.attributes.toArray();
    const dependenciesBefore = [...dependencies];
    const decompositionBefore = decomposition.map((attributes) => attributes.toArray());

    const analysis = analyzeDependencyPreservation(schema, dependencies, decomposition);

    expect(schema.attributes.toArray()).toEqual(relationBefore);
    expect(schemaAttributes.toArray()).toEqual(relationBefore);
    expect(left.toArray()).toEqual([a]);
    expect(right.toArray()).toEqual([b]);
    expect(dependencies).toEqual(dependenciesBefore);
    expect(decomposition.map((attributes) => attributes.toArray()))
      .toEqual(decompositionBefore);
    expect(Object.isFrozen(analysis)).toBe(true);
    expect(Object.isFrozen(analysis.preservedDependencies)).toBe(true);
    expect(Object.isFrozen(analysis.lostDependencies)).toBe(true);
    expect(analysis.preservedDependencies.every(Object.isFrozen)).toBe(true);
  });
});

function intersection(left: AttributeSet, right: AttributeSet): AttributeSet {
  return new AttributeSet(left.toArray().filter((attribute) => right.has(attribute)));
}
