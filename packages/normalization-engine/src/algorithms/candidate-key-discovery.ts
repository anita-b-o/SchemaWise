import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";
import { attributeCombinations } from "./attribute-subsets.js";
import { validateRelationScope } from "./relation-scope.js";
import { isSuperkeyWithinValidatedScope } from "./relation-superkey.js";

/** Returns every inclusion-minimal superkey in deterministic order. */
export function findCandidateKeys(
  relation: Relation,
  dependencies: Iterable<FunctionalDependency>,
): readonly AttributeSet[] {
  const functionalDependencies = validateRelationScope(
    "Candidate key discovery",
    relation,
    dependencies,
  );
  const rightHandAttributes = new AttributeSet(
    functionalDependencies.flatMap(({ right }) => right.toArray()),
  );
  const mandatory = relation.attributes.difference(rightHandAttributes);
  const optional = relation.attributes.difference(mandatory).toArray();
  const candidateKeys: AttributeSet[] = [];

  for (let additionalSize = 0; additionalSize <= optional.length; additionalSize += 1) {
    for (const additionalAttributes of attributeCombinations(optional, additionalSize)) {
      const candidate = mandatory.union(new AttributeSet(additionalAttributes));

      if (candidateKeys.some((key) => key.isSubsetOf(candidate))) {
        continue;
      }

      if (isSuperkeyWithinValidatedScope(candidate, relation, functionalDependencies)) {
        candidateKeys.push(candidate);
      }
    }
  }

  return Object.freeze(candidateKeys);
}
