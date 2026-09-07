import { attributeClosure } from "./attribute-closure.js";
import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";

export function isSuperkeyWithinValidatedScope(
  attributes: AttributeSet,
  relation: Relation,
  dependencies: readonly FunctionalDependency[],
): boolean {
  const closure = attributeClosure(attributes, dependencies);
  return relation.attributes.isSubsetOf(closure);
}
