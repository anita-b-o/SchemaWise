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

export interface SecondNormalFormViolation {
  readonly candidateKey: AttributeSet;
  readonly determinant: AttributeSet;
  readonly dependent: Attribute;
}

export type SecondNormalFormAnalysis = NormalFormAnalysis<SecondNormalFormViolation>;

/** Analyzes 2NF under the explicit precondition that `relation` is in 1NF. */
export function analyzeSecondNormalForm(
  relation: Relation,
  dependencies: Iterable<FunctionalDependency>,
): SecondNormalFormAnalysis {
  const functionalDependencies = validateRelationScope(
    "Second normal form analysis",
    relation,
    dependencies,
  );
  const candidateKeys = findCandidateKeys(relation, functionalDependencies);
  const primeAttributes = primeAttributesFromCandidateKeys(candidateKeys);
  const nonPrimeAttributes = relation.attributes.difference(primeAttributes);
  const uniqueViolations = new Map<string, SecondNormalFormViolation>();

  for (const candidateKey of candidateKeys) {
    const keyAttributes = candidateKey.toArray();

    for (const subset of attributeSubsets(keyAttributes, keyAttributes.length - 1)) {
      const determinant = new AttributeSet(subset);
      const closure = attributeClosure(determinant, functionalDependencies);

      for (const dependent of closure.difference(determinant).toArray()) {
        if (!nonPrimeAttributes.has(dependent)) {
          continue;
        }

        const violation = Object.freeze({ candidateKey, determinant, dependent });
        uniqueViolations.set(violationKey(violation), violation);
      }
    }
  }

  const violations = Object.freeze(
    [...uniqueViolations.values()].sort(compareViolations),
  );
  return Object.freeze({ satisfied: violations.length === 0, violations });
}

function violationKey(violation: SecondNormalFormViolation): string {
  return JSON.stringify([
    attributeSetKey(violation.determinant),
    violation.dependent.id,
    attributeSetKey(violation.candidateKey),
  ]);
}

function compareViolations(
  left: SecondNormalFormViolation,
  right: SecondNormalFormViolation,
): number {
  return compareAttributeSets(left.determinant, right.determinant)
    || compareIds(left.dependent.id, right.dependent.id)
    || compareAttributeSets(left.candidateKey, right.candidateKey);
}
