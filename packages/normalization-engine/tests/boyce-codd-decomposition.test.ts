import { describe, expect, it } from "vitest";
import {
  analyzeBoyceCoddNormalForm,
  attributeClosure,
  Attribute,
  AttributeSet,
  decomposeToBoyceCoddNormalForm,
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

function attributeIds(attributes: AttributeSet): string[] {
  return attributes.toArray().map(({ id }) => id);
}

function relationIds(result: ReturnType<typeof decomposeToBoyceCoddNormalForm>) {
  return result.relations.map(({ attributes }) => attributeIds(attributes));
}

function stepIds(result: ReturnType<typeof decomposeToBoyceCoddNormalForm>) {
  return result.steps.map(({ source, violation, result: children }) => ({
    source: attributeIds(source),
    determinant: attributeIds(violation.determinant),
    dependent: violation.dependent.id,
    result: children.map(attributeIds),
  }));
}

describe("decomposeToBoyceCoddNormalForm", () => {
  it("returns an already-BCNF relation unchanged and records no steps", () => {
    const result = decomposeToBoyceCoddNormalForm(
      relation(a, b, c),
      [fd([a], [b]), fd([a], [c])],
    );

    expect(relationIds(result)).toEqual([["a", "b", "c"]]);
    expect(result.steps).toEqual([]);
  });

  it("decomposes the classical violation B -> C", () => {
    const result = decomposeToBoyceCoddNormalForm(
      relation(a, b, c),
      [fd([a], [b]), fd([b], [c])],
    );

    expect(relationIds(result)).toEqual([["a", "b"], ["b", "c"]]);
    expect(stepIds(result)).toEqual([{
      source: ["a", "b", "c"],
      determinant: ["b"],
      dependent: "c",
      result: [["b", "c"], ["a", "b"]],
    }]);
  });

  it("decomposes a relation that is in 3NF but not BCNF", () => {
    const result = decomposeToBoyceCoddNormalForm(
      relation(a, b, c),
      [fd([a, b], [c]), fd([c], [b])],
    );

    expect(relationIds(result)).toEqual([["a", "c"], ["b", "c"]]);
    expect(stepIds(result)[0]).toMatchObject({
      determinant: ["c"],
      dependent: "b",
    });
  });

  it("recurses through multiple levels and uses an implied projected violation", () => {
    const schema = relation(a, b, c, d);
    const dependencies = [fd([a], [b]), fd([b], [c]), fd([c], [d])];
    const result = decomposeToBoyceCoddNormalForm(schema, dependencies);

    expect(relationIds(result)).toEqual([
      ["a", "b"],
      ["b", "c"],
      ["b", "d"],
    ]);
    expect(stepIds(result)).toEqual([
      {
        source: ["a", "b", "c", "d"],
        determinant: ["b"],
        dependent: "c",
        result: [["b", "c"], ["a", "b", "d"]],
      },
      {
        source: ["a", "b", "d"],
        determinant: ["b"],
        dependent: "d",
        result: [["b", "d"], ["a", "b"]],
      },
    ]);
    expect(dependencies.some((dependency) =>
      dependency.left.equals(set(b)) && dependency.right.has(d)
    )).toBe(false);
    expect(projectFunctionalDependencies(schema, dependencies, set(a, b, d)).some(
      (dependency) => dependency.left.equals(set(b)) && dependency.right.equals(set(d)),
    )).toBe(true);
  });

  it("treats a relation without dependencies as BCNF", () => {
    const result = decomposeToBoyceCoddNormalForm(relation(a, b, c), []);

    expect(relationIds(result)).toEqual([["a", "b", "c"]]);
    expect(result.steps).toEqual([]);
  });

  it("supports an empty determinant whether it is a superkey or a violation", () => {
    const superkey = decomposeToBoyceCoddNormalForm(
      relation(a, b),
      [fd([], [a]), fd([a], [b])],
    );
    expect(relationIds(superkey)).toEqual([["a", "b"]]);
    expect(superkey.steps).toEqual([]);

    const violation = decomposeToBoyceCoddNormalForm(
      relation(a, b, c),
      [fd([], [a])],
    );
    expect(relationIds(violation)).toEqual([["a"], ["b", "c"]]);
    expect(stepIds(violation)).toEqual([{
      source: ["a", "b", "c"],
      determinant: [],
      dependent: "a",
      result: [["a"], ["b", "c"]],
    }]);
  });

  it("terminates on dependency cycles", () => {
    const result = decomposeToBoyceCoddNormalForm(
      relation(a, b, c),
      [fd([a], [b]), fd([b], [a])],
    );

    expect(relationIds(result)).toEqual([["a", "b"], ["a", "c"]]);
    expect(result.steps).toHaveLength(1);
  });

  it("selects the first canonical violation", () => {
    const result = decomposeToBoyceCoddNormalForm(
      relation(a, b, c, d),
      [fd([b], [d]), fd([b], [c]), fd([c], [d])],
    );

    expect(stepIds(result)[0]).toMatchObject({
      determinant: ["b"],
      dependent: "c",
    });
  });

  it("is canonical under attribute, RHS, and dependency reordering", () => {
    const first = decomposeToBoyceCoddNormalForm(
      relation(d, c, b, a),
      [fd([c], [d]), fd([b], [d, c]), fd([a], [b])],
    );
    const second = decomposeToBoyceCoddNormalForm(
      relation(a, b, c, d),
      [fd([a], [b]), fd([b], [c, d]), fd([c], [d])],
    );

    expect(relationIds(first)).toEqual(relationIds(second));
    expect(stepIds(first)).toEqual(stepIds(second));
  });

  it("leaves every result in BCNF under its projection", () => {
    const cases = [
      [relation(a, b, c), [fd([a], [b]), fd([b], [c])]],
      [relation(a, b, c), [fd([a, b], [c]), fd([c], [b])]],
      [relation(a, b, c, d), [fd([a], [b]), fd([b], [c]), fd([c], [d])]],
      [relation(a, b, c), [fd([], [a])]],
      [relation(a, b, c), []],
    ] as const;

    for (const [schema, dependencies] of cases) {
      const result = decomposeToBoyceCoddNormalForm(schema, dependencies);
      for (const leaf of result.relations) {
        const projection = projectFunctionalDependencies(
          schema,
          dependencies,
          leaf.attributes,
        );
        expect(analyzeBoyceCoddNormalForm(
          Relation.create("leaf", leaf.attributes),
          projection,
        ).satisfied).toBe(true);
      }
    }
  });

  it("records the structural lossless condition for every step", () => {
    const schema = relation(a, b, c, d);
    const dependencies = [fd([a], [b]), fd([b], [c]), fd([c], [d])];
    const result = decomposeToBoyceCoddNormalForm(schema, dependencies);

    for (const step of result.steps) {
      const [left, right] = step.result;
      expect(left.union(right).equals(step.source)).toBe(true);
      expect(intersection(left, right).equals(step.violation.determinant)).toBe(true);

      const projection = projectFunctionalDependencies(
        schema,
        dependencies,
        step.source,
      );
      expect(attributeClosure(step.violation.determinant, projection)
        .has(step.violation.dependent)).toBe(true);
    }
  });

  it("rejects original dependencies outside the relation scope", () => {
    expect(() => decomposeToBoyceCoddNormalForm(
      relation(a, b),
      [fd([a], [c])],
    )).toThrow(/Functional dependency RHS.*external attribute ids: c/);
  });

  it("preserves the existing attribute identity-collision policy", () => {
    const conflictingA = Attribute.create("a", "Account number");

    expect(() => decomposeToBoyceCoddNormalForm(
      relation(a, b),
      [fd([conflictingA], [b])],
    )).toThrow(/Attribute identity conflict/);
  });

  it("does not mutate inputs and exposes immutable result structures", () => {
    const schemaAttributes = set(d, c, b, a);
    const schema = Relation.create("R", schemaAttributes);
    const left = set(b);
    const right = set(c);
    const dependency = FunctionalDependency.create(left, right);
    const dependencies = [dependency, fd([c], [d]), fd([a], [b])];
    const relationBefore = schema.attributes.toArray();
    const leftBefore = left.toArray();
    const rightBefore = right.toArray();

    const result = decomposeToBoyceCoddNormalForm(schema, dependencies);
    const stepsBefore = stepIds(result);
    decomposeToBoyceCoddNormalForm(schema, [...dependencies].reverse());

    expect(schema.attributes.toArray()).toEqual(relationBefore);
    expect(schemaAttributes.toArray()).toEqual(relationBefore);
    expect(left.toArray()).toEqual(leftBefore);
    expect(right.toArray()).toEqual(rightBefore);
    expect(dependencies).toEqual([dependency, dependencies[1], dependencies[2]]);
    expect(stepIds(result)).toEqual(stepsBefore);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.relations)).toBe(true);
    expect(Object.isFrozen(result.steps)).toBe(true);
    expect(result.relations.every(Object.isFrozen)).toBe(true);
    expect(result.steps.every((step) =>
      Object.isFrozen(step)
      && Object.isFrozen(step.violation)
      && Object.isFrozen(step.result)
    )).toBe(true);
  });
});

function intersection(left: AttributeSet, right: AttributeSet): AttributeSet {
  return new AttributeSet(left.toArray().filter((attribute) => right.has(attribute)));
}
