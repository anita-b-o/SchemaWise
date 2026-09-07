import { attributeClosure } from "./attribute-closure.js";
import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";
import { validateRelationScope } from "./relation-scope.js";

/** Returns whether `attributes` functionally determines every attribute of `relation`. */
export function isSuperkey(
  attributes: AttributeSet,
  relation: Relation,
  dependencies: Iterable<FunctionalDependency>,
): boolean {
  const functionalDependencies = validateRelationScope(
    "Superkey detection",
    relation,
    dependencies,
    attributes,
  );
  const closure = attributeClosure(attributes, functionalDependencies);
  return relation.attributes.isSubsetOf(closure);
}
