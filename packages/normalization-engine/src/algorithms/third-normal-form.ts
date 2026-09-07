import { Attribute } from "../domain/attribute.js";
import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";
import { attributeClosure } from "./attribute-closure.js";
import { attributeSubsets } from "./attribute-subsets.js";
import { findCandidateKeys } from "./candidate-key-discovery.js";
import { NormalFormAnalysis } from "./normal-form-analysis.js";
import {
  attributeSetKey,
  compareAttributeSets,
  compareIds,
} from "./normal-form-order.js";
import { primeAttributesFromCandidateKeys } from "./prime-attributes.js";
import { validateRelationScope } from "./relation-scope.js";
import { isClosureSuperkeyWithinValidatedScope } from "./relation-superkey.js";

export interface ThirdNormalFormViolation {
  readonly determinant: AttributeSet;
  readonly dependent: Attribute;
}

export type ThirdNormalFormAnalysis = NormalFormAnalysis<ThirdNormalFormViolation>;

/** Analyzes 3NF under the explicit precondition that `relation` is in 1NF. */
export function analyzeThirdNormalForm(
  relation: Relation,
  dependencies: Iterable<FunctionalDependency>,
): ThirdNormalFormAnalysis {
  const functionalDependencies = validateRelationScope(
    "Third normal form analysis",
    relation,
    dependencies,
  );
  const candidateKeys = findCandidateKeys(relation, functionalDependencies);
  const primeAttributes = primeAttributesFromCandidateKeys(candidateKeys);
  const uniqueViolations = new Map<string, ThirdNormalFormViolation>();
  const relationAttributes = relation.attributes.toArray();

  for (const subset of attributeSubsets(relationAttributes)) {
    const determinant = new AttributeSet(subset);
    const closure = attributeClosure(determinant, functionalDependencies);

    if (isClosureSuperkeyWithinValidatedScope(closure, relation)) {
      continue;
    }

    for (const dependent of closure.difference(determinant).toArray()) {
      if (primeAttributes.has(dependent)) {
        continue;
      }

      const violation = Object.freeze({ determinant, dependent });
      uniqueViolations.set(violationKey(violation), violation);
    }
  }

  const violations = Object.freeze(
    [...uniqueViolations.values()].sort(compareViolations),
  );
  return Object.freeze({ satisfied: violations.length === 0, violations });
}

function violationKey(violation: ThirdNormalFormViolation): string {
  return JSON.stringify([
    attributeSetKey(violation.determinant),
    violation.dependent.id,
  ]);
}

function compareViolations(
  left: ThirdNormalFormViolation,
  right: ThirdNormalFormViolation,
): number {
  return compareAttributeSets(left.determinant, right.determinant)
    || compareIds(left.dependent.id, right.dependent.id);
}
