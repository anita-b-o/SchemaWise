import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";
import { attributeClosure } from "./attribute-closure.js";
import { projectFunctionalDependencies } from "./functional-dependency-projection.js";
import { findMinimalCover } from "./minimal-cover.js";
import { attributeSetKey, compareAttributeSets } from "./normal-form-order.js";
import { validateRelationScope } from "./relation-scope.js";

export interface DependencyPreservationAnalysis {
  readonly preserved: boolean;
  readonly preservedDependencies: readonly FunctionalDependency[];
  readonly lostDependencies: readonly FunctionalDependency[];
}

/** Checks whether local projected dependencies imply the original dependencies. */
export function analyzeDependencyPreservation(
  relation: Relation,
  dependencies: Iterable<FunctionalDependency>,
  decomposition: Iterable<AttributeSet>,
): DependencyPreservationAnalysis {
  const originalDependencies = validateRelationScope(
    "Dependency preservation analysis",
    relation,
    dependencies,
  );
  const subrelations = validateDecomposition(relation, decomposition);
  const minimalCover = findMinimalCover(relation, originalDependencies);
  const projectedUnion = unionProjectedDependencies(
    relation,
    originalDependencies,
    subrelations,
  );
  const preservedDependencies: FunctionalDependency[] = [];
  const lostDependencies: FunctionalDependency[] = [];

  for (const dependency of minimalCover) {
    const dependent = dependency.right.toArray()[0];
    if (dependent === undefined) {
      throw new Error(
        "Dependency preservation analysis invariant failed: expected a singleton RHS",
      );
    }

    const target = attributeClosure(dependency.left, projectedUnion).has(dependent)
      ? preservedDependencies
      : lostDependencies;
    target.push(dependency);
  }

  return Object.freeze({
    preserved: lostDependencies.length === 0,
    preservedDependencies: Object.freeze(preservedDependencies),
    lostDependencies: Object.freeze(lostDependencies),
  });
}

function validateDecomposition(
  relation: Relation,
  decomposition: Iterable<AttributeSet>,
): readonly AttributeSet[] {
  const materialized = [...decomposition];
  let coveredAttributes = new AttributeSet();

  for (const attributes of materialized) {
    validateRelationScope(
      "Dependency preservation analysis",
      relation,
      [],
      attributes,
    );
    coveredAttributes = coveredAttributes.union(attributes);
  }

  const missingAttributes = relation.attributes.difference(coveredAttributes);
  if (missingAttributes.size > 0) {
    const missingIds = missingAttributes.toArray().map(({ id }) => id).join(", ");
    throw new Error(
      "Dependency preservation analysis: decomposition must cover every "
        + `attribute of relation "${relation.name}"; missing attribute ids: ${missingIds}`,
    );
  }

  const unique = new Map<string, AttributeSet>();
  for (const attributes of materialized) {
    unique.set(attributeSetKey(attributes), attributes);
  }

  return Object.freeze([...unique.values()].sort(compareAttributeSets));
}

function unionProjectedDependencies(
  relation: Relation,
  dependencies: readonly FunctionalDependency[],
  subrelations: readonly AttributeSet[],
): readonly FunctionalDependency[] {
  const union = new Map<string, FunctionalDependency>();

  for (const attributes of subrelations) {
    const projection = projectFunctionalDependencies(relation, dependencies, attributes);
    for (const dependency of projection) {
      union.set(dependencyKey(dependency), dependency);
    }
  }

  return Object.freeze([...union.values()]);
}

function dependencyKey(dependency: FunctionalDependency): string {
  return JSON.stringify([
    dependency.left.toArray().map(({ id }) => id),
    dependency.right.toArray().map(({ id }) => id),
  ]);
}
