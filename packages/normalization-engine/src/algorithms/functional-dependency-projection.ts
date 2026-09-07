import { Attribute } from "../domain/attribute.js";
import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";
import { attributeClosure } from "./attribute-closure.js";
import { findMinimalCover } from "./minimal-cover.js";
import { validateRelationScope } from "./relation-scope.js";

/** Returns a deterministic minimal cover of the dependencies implied over `attributes`. */
export function projectFunctionalDependencies(
  relation: Relation,
  dependencies: Iterable<FunctionalDependency>,
  attributes: AttributeSet,
): readonly FunctionalDependency[] {
  const validatedDependencies = validateRelationScope(
    "Functional dependency projection",
    relation,
    dependencies,
    attributes,
  );
  const targetAttributes = attributes.toArray();
  const projectedDependencies: FunctionalDependency[] = [];

  enumerateSubsets(targetAttributes, (determinant) => {
    const closure = attributeClosure(determinant, validatedDependencies);
    const nonTrivialDependents = intersection(closure, attributes).difference(determinant);

    for (const dependent of nonTrivialDependents.toArray()) {
      projectedDependencies.push(FunctionalDependency.create(
        determinant,
        new AttributeSet([dependent]),
      ));
    }
  });

  // Minimal cover only uses the relation as its validation scope. Keeping the
  // original relation here also supports projection onto the empty schema.
  return findMinimalCover(relation, projectedDependencies);
}

function enumerateSubsets(
  attributes: readonly Attribute[],
  visit: (subset: AttributeSet) => void,
): void {
  const selected: Attribute[] = [];

  function enumerateFrom(index: number): void {
    if (index === attributes.length) {
      visit(new AttributeSet(selected));
      return;
    }

    enumerateFrom(index + 1);

    const attribute = attributes[index];
    if (attribute !== undefined) {
      selected.push(attribute);
      enumerateFrom(index + 1);
      selected.pop();
    }
  }

  enumerateFrom(0);
}

function intersection(left: AttributeSet, right: AttributeSet): AttributeSet {
  return new AttributeSet(left.toArray().filter((attribute) => right.has(attribute)));
}
