import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";
import {
  analyzeBoyceCoddNormalForm,
  BoyceCoddNormalFormViolation,
} from "./boyce-codd-normal-form.js";
import { projectFunctionalDependencies } from "./functional-dependency-projection.js";
import { attributeSetKey, compareAttributeSets } from "./normal-form-order.js";
import { validateRelationScope } from "./relation-scope.js";

/** A BCNF leaf schema represented without inventing a persistent relation name. */
export interface BcnfRelation {
  readonly attributes: AttributeSet;
}

/** Evidence for one lossless binary decomposition, recorded in depth-first pre-order. */
export interface BcnfDecompositionStep {
  readonly source: AttributeSet;
  readonly violation: BoyceCoddNormalFormViolation;
  readonly result: readonly [AttributeSet, AttributeSet];
}

export interface BoyceCoddDecomposition {
  readonly relations: readonly BcnfRelation[];
  readonly steps: readonly BcnfDecompositionStep[];
}

/** Decomposes a relation into deterministic BCNF leaves through lossless binary steps. */
export function decomposeToBoyceCoddNormalForm(
  relation: Relation,
  dependencies: Iterable<FunctionalDependency>,
): BoyceCoddDecomposition {
  const originalDependencies = validateRelationScope(
    "Boyce-Codd normal form decomposition",
    relation,
    dependencies,
  );
  const leaves: AttributeSet[] = [];
  const steps: BcnfDecompositionStep[] = [];

  function decompose(source: AttributeSet): void {
    const projection = projectFunctionalDependencies(
      relation,
      originalDependencies,
      source,
    );
    const scopedRelation = Relation.create(relation.name, source);
    const analysis = analyzeBoyceCoddNormalForm(scopedRelation, projection);

    if (analysis.satisfied) {
      leaves.push(source);
      return;
    }

    const violation = analysis.violations[0];
    if (violation === undefined) {
      throw new Error(
        "BCNF decomposition invariant failed: unsatisfied analysis has no violation",
      );
    }

    const dependent = new AttributeSet([violation.dependent]);
    const left = violation.determinant.union(dependent);
    const removed = dependent.difference(violation.determinant);
    const right = source.difference(removed);

    assertValidDecomposition(source, violation, left, right);

    const step = Object.freeze({
      source,
      violation,
      result: Object.freeze([left, right]) as readonly [AttributeSet, AttributeSet],
    });
    steps.push(step);

    decompose(left);
    decompose(right);
  }

  decompose(relation.attributes);

  const uniqueLeaves = new Map<string, AttributeSet>();
  for (const leaf of leaves) {
    uniqueLeaves.set(attributeSetKey(leaf), leaf);
  }

  const relations = [...uniqueLeaves.values()]
    .sort(compareAttributeSets)
    .map((attributes) => Object.freeze({ attributes }));

  return Object.freeze({
    relations: Object.freeze(relations),
    steps: Object.freeze(steps),
  });
}

function assertValidDecomposition(
  source: AttributeSet,
  violation: BoyceCoddNormalFormViolation,
  left: AttributeSet,
  right: AttributeSet,
): void {
  const determinant = violation.determinant;
  const dependent = new AttributeSet([violation.dependent]);
  const intersection = intersect(left, right);

  const valid = determinant.isSubsetOf(source)
    && dependent.isSubsetOf(source)
    && !determinant.has(violation.dependent)
    && left.size > 0
    && right.size > 0
    && left.size < source.size
    && right.size < source.size
    && left.union(right).equals(source)
    && intersection.equals(determinant);

  if (!valid) {
    throw new Error(
      "BCNF decomposition invariant failed: violation did not produce two "
        + "strictly smaller schemas whose union is the source and intersection is the determinant",
    );
  }
}

function intersect(left: AttributeSet, right: AttributeSet): AttributeSet {
  return new AttributeSet(left.toArray().filter((attribute) => right.has(attribute)));
}
