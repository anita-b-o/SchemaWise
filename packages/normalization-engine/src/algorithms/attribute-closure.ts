import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";

/** Returns the attributes functionally determined by `attributes`. */
export function attributeClosure(
  attributes: AttributeSet,
  dependencies: Iterable<FunctionalDependency>,
): AttributeSet {
  const functionalDependencies = [...dependencies];
  assertConsistentAttributeIdentities(attributes, functionalDependencies);

  let closure = new AttributeSet(attributes.toArray());
  let changed = true;

  while (changed) {
    changed = false;

    for (const dependency of functionalDependencies) {
      if (!dependency.left.isSubsetOf(closure)) {
        continue;
      }

      const expandedClosure = closure.union(dependency.right);
      if (!expandedClosure.equals(closure)) {
        closure = expandedClosure;
        changed = true;
      }
    }
  }

  return closure;
}

function assertConsistentAttributeIdentities(
  attributes: AttributeSet,
  dependencies: readonly FunctionalDependency[],
): void {
  new AttributeSet([
    ...attributes.toArray(),
    ...dependencies.flatMap((dependency) => [
      ...dependency.left.toArray(),
      ...dependency.right.toArray(),
    ]),
  ]);
}
