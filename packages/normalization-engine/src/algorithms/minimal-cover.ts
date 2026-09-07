import { Attribute } from "../domain/attribute.js";
import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";
import { attributeClosure } from "./attribute-closure.js";
import { validateRelationScope } from "./relation-scope.js";

/** Returns a deterministic minimal cover equivalent to `dependencies` over `relation`. */
export function findMinimalCover(
  relation: Relation,
  dependencies: Iterable<FunctionalDependency>,
): readonly FunctionalDependency[] {
  const validatedDependencies = validateRelationScope(
    "Minimal cover",
    relation,
    dependencies,
  );

  let cover = deduplicateAndSort(decomposeRightSides(validatedDependencies));
  cover = removeExtraneousLeftAttributes(cover);
  cover = removeRedundantDependencies(cover);

  return Object.freeze(deduplicateAndSort(cover));
}

function decomposeRightSides(
  dependencies: readonly FunctionalDependency[],
): FunctionalDependency[] {
  return dependencies.flatMap(({ left, right }) =>
    right.toArray().map((attribute) => createDependency(left.toArray(), attribute)),
  );
}

function removeExtraneousLeftAttributes(
  dependencies: readonly FunctionalDependency[],
): FunctionalDependency[] {
  const cover = [...dependencies];

  for (let dependencyIndex = 0; dependencyIndex < cover.length; dependencyIndex += 1) {
    let dependency = cover[dependencyIndex];
    if (dependency === undefined) {
      continue;
    }

    for (const attribute of dependency.left.toArray()) {
      const reducedLeft = dependency.left.difference(new AttributeSet([attribute]));
      const rightAttribute = onlyRightAttribute(dependency);

      if (attributeClosure(reducedLeft, cover).has(rightAttribute)) {
        dependency = createDependency(reducedLeft.toArray(), rightAttribute);
        cover[dependencyIndex] = dependency;
      }
    }
  }

  return deduplicateAndSort(cover);
}

function removeRedundantDependencies(
  dependencies: readonly FunctionalDependency[],
): FunctionalDependency[] {
  const cover = [...dependencies];

  for (let dependencyIndex = 0; dependencyIndex < cover.length;) {
    const dependency = cover[dependencyIndex];
    if (dependency === undefined) {
      dependencyIndex += 1;
      continue;
    }

    const remaining = cover.filter((_, index) => index !== dependencyIndex);
    if (attributeClosure(dependency.left, remaining).has(onlyRightAttribute(dependency))) {
      cover.splice(dependencyIndex, 1);
    } else {
      dependencyIndex += 1;
    }
  }

  return cover;
}

function createDependency(
  left: readonly Attribute[],
  right: Attribute,
): FunctionalDependency {
  return FunctionalDependency.create(new AttributeSet(left), new AttributeSet([right]));
}

function onlyRightAttribute(dependency: FunctionalDependency): Attribute {
  const attribute = dependency.right.toArray()[0];
  if (attribute === undefined) {
    throw new Error("Minimal cover internal invariant: expected a singleton RHS");
  }
  return attribute;
}

function deduplicateAndSort(
  dependencies: readonly FunctionalDependency[],
): FunctionalDependency[] {
  const uniqueDependencies = new Map<string, FunctionalDependency>();

  for (const dependency of dependencies) {
    uniqueDependencies.set(dependencyKey(dependency), dependency);
  }

  return [...uniqueDependencies.values()].sort(compareDependencies);
}

function dependencyKey(dependency: FunctionalDependency): string {
  return JSON.stringify([
    dependency.left.toArray().map(({ id }) => id),
    dependency.right.toArray().map(({ id }) => id),
  ]);
}

function compareDependencies(
  left: FunctionalDependency,
  right: FunctionalDependency,
): number {
  if (left.left.size !== right.left.size) {
    return left.left.size - right.left.size;
  }

  const leftIds = left.left.toArray().map(({ id }) => id);
  const rightIds = right.left.toArray().map(({ id }) => id);
  const leftComparison = compareIdLists(leftIds, rightIds);
  if (leftComparison !== 0) {
    return leftComparison;
  }

  return compareIds(onlyRightAttribute(left).id, onlyRightAttribute(right).id);
}

function compareIdLists(left: readonly string[], right: readonly string[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const comparison = compareIds(left[index] ?? "", right[index] ?? "");
    if (comparison !== 0) {
      return comparison;
    }
  }
  return left.length - right.length;
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
