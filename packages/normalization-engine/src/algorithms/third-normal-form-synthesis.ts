import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";
import { findCandidateKeys } from "./candidate-key-discovery.js";
import { findMinimalCover } from "./minimal-cover.js";
import { attributeSetKey, compareAttributeSets } from "./normal-form-order.js";

export type SynthesizedRelationSource = "minimal-cover" | "candidate-key";

/** A synthesized schema represented without inventing a persistent relation name. */
export interface SynthesizedRelation {
  readonly attributes: AttributeSet;
  readonly source: SynthesizedRelationSource;
}

export interface ThirdNormalFormSynthesis {
  readonly relations: readonly SynthesizedRelation[];
  readonly minimalCover: readonly FunctionalDependency[];
  readonly addedCandidateKey: AttributeSet | null;
}

/** Synthesizes a deterministic, dependency-preserving, lossless 3NF decomposition. */
export function synthesizeThirdNormalForm(
  relation: Relation,
  dependencies: Iterable<FunctionalDependency>,
): ThirdNormalFormSynthesis {
  const minimalCover = findMinimalCover(relation, dependencies);
  const groupedRelations = groupByLeftHandSide(minimalCover);
  const dependencyRelations = removeContainedRelations(groupedRelations);
  const candidateKeys = findCandidateKeys(relation, minimalCover);
  const containsCandidateKey = dependencyRelations.some((synthesized) =>
    candidateKeys.some((key) => key.isSubsetOf(synthesized))
  );
  const addedCandidateKey = containsCandidateKey
    ? null
    : candidateKeys[0] ?? relation.attributes;

  const relations: SynthesizedRelation[] = dependencyRelations.map((attributes) =>
    Object.freeze({ attributes, source: "minimal-cover" as const })
  );

  if (addedCandidateKey !== null) {
    relations.push(Object.freeze({
      attributes: addedCandidateKey,
      source: "candidate-key" as const,
    }));
  }

  relations.sort((left, right) => compareAttributeSets(left.attributes, right.attributes));

  return Object.freeze({
    relations: Object.freeze(relations),
    minimalCover,
    addedCandidateKey,
  });
}

function groupByLeftHandSide(
  minimalCover: readonly FunctionalDependency[],
): readonly AttributeSet[] {
  const grouped = new Map<string, AttributeSet>();

  for (const dependency of minimalCover) {
    const key = attributeSetKey(dependency.left);
    const existing = grouped.get(key) ?? dependency.left;
    grouped.set(key, existing.union(dependency.right));
  }

  return deduplicateAndSort([...grouped.values()]);
}

function removeContainedRelations(relations: readonly AttributeSet[]): readonly AttributeSet[] {
  return relations.filter((candidate, candidateIndex) =>
    !relations.some((container, containerIndex) =>
      candidateIndex !== containerIndex
      && candidate.isSubsetOf(container)
      && !candidate.equals(container)
    )
  );
}

function deduplicateAndSort(relations: readonly AttributeSet[]): readonly AttributeSet[] {
  const unique = new Map<string, AttributeSet>();
  for (const relation of relations) {
    unique.set(attributeSetKey(relation), relation);
  }
  return [...unique.values()].sort(compareAttributeSets);
}
