import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";
import { findCandidateKeys } from "./candidate-key-discovery.js";

/** Returns the attributes that belong to at least one candidate key. */
export function findPrimeAttributes(
  relation: Relation,
  dependencies: Iterable<FunctionalDependency>,
): AttributeSet {
  return primeAttributesFromCandidateKeys(findCandidateKeys(relation, dependencies));
}

export function primeAttributesFromCandidateKeys(
  candidateKeys: readonly AttributeSet[],
): AttributeSet {
  return candidateKeys.reduce(
    (primeAttributes, candidateKey) => primeAttributes.union(candidateKey),
    new AttributeSet(),
  );
}
