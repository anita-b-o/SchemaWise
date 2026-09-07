import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";
import { validateRelationScope } from "./relation-scope.js";
import { isSuperkeyWithinValidatedScope } from "./relation-superkey.js";

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
  return isSuperkeyWithinValidatedScope(attributes, relation, functionalDependencies);
}
