import { Attribute } from "../domain/attribute.js";
import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";
import { attributeClosure } from "./attribute-closure.js";
import { attributeSubsets } from "./attribute-subsets.js";
import { NormalFormAnalysis } from "./normal-form-analysis.js";
import {
  attributeSetKey,
  compareAttributeSets,
  compareIds,
} from "./normal-form-order.js";
import { validateRelationScope } from "./relation-scope.js";
import { isClosureSuperkeyWithinValidatedScope } from "./relation-superkey.js";

export interface BoyceCoddNormalFormViolation {
  readonly determinant: AttributeSet;
  readonly dependent: Attribute;
}

export type BoyceCoddNormalFormAnalysis =
  NormalFormAnalysis<BoyceCoddNormalFormViolation>;

/** Analyzes BCNF under the explicit precondition that `relation` is in 1NF. */
export function analyzeBoyceCoddNormalForm(
  relation: Relation,
  dependencies: Iterable<FunctionalDependency>,
): BoyceCoddNormalFormAnalysis {
  const functionalDependencies = validateRelationScope(
    "Boyce-Codd normal form analysis",
    relation,
    dependencies,
  );
  const uniqueViolations = new Map<string, BoyceCoddNormalFormViolation>();

  for (const subset of attributeSubsets(relation.attributes.toArray())) {
    const determinant = new AttributeSet(subset);
    const closure = attributeClosure(determinant, functionalDependencies);

    if (isClosureSuperkeyWithinValidatedScope(closure, relation)) {
      continue;
    }

    for (const dependent of closure.difference(determinant).toArray()) {
      const violation = Object.freeze({ determinant, dependent });
      uniqueViolations.set(violationKey(violation), violation);
    }
  }

  const violations = Object.freeze(
    [...uniqueViolations.values()].sort(compareViolations),
  );
  return Object.freeze({ satisfied: violations.length === 0, violations });
}

function violationKey(violation: BoyceCoddNormalFormViolation): string {
  return JSON.stringify([
    attributeSetKey(violation.determinant),
    violation.dependent.id,
  ]);
}

function compareViolations(
  left: BoyceCoddNormalFormViolation,
  right: BoyceCoddNormalFormViolation,
): number {
  return compareAttributeSets(left.determinant, right.determinant)
    || compareIds(left.dependent.id, right.dependent.id);
}
