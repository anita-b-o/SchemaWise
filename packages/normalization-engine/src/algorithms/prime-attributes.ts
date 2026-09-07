import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";
import { findCandidateKeys } from "./candidate-key-discovery.js";

/** Returns the attributes that belong to at least one candidate key. */
export function findPrimeAttributes(
  relation: Relation,
  dependencies: Iterable<FunctionalDependency>,
): AttributeSet {
  return findCandidateKeys(relation, dependencies).reduce(
    (primeAttributes, candidateKey) => primeAttributes.union(candidateKey),
    new AttributeSet(),
  );
}
