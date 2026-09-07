import { AttributeSet } from "../domain/attribute-set.js";
import { FunctionalDependency } from "../domain/functional-dependency.js";
import { Relation } from "../domain/relation.js";

export function validateRelationScope(
  operation: string,
  relation: Relation,
  dependencies: Iterable<FunctionalDependency>,
  attributes?: AttributeSet,
): readonly FunctionalDependency[] {
  const functionalDependencies = [...dependencies];

  new AttributeSet([
    ...relation.attributes.toArray(),
    ...(attributes?.toArray() ?? []),
    ...functionalDependencies.flatMap((dependency) => [
      ...dependency.left.toArray(),
      ...dependency.right.toArray(),
    ]),
  ]);

  if (attributes !== undefined) {
    assertWithinRelation(operation, "Input attributes", attributes, relation);
  }

  assertWithinRelation(
    operation,
    "Functional dependency LHS",
    new AttributeSet(functionalDependencies.flatMap(({ left }) => left.toArray())),
    relation,
  );
  assertWithinRelation(
    operation,
    "Functional dependency RHS",
    new AttributeSet(functionalDependencies.flatMap(({ right }) => right.toArray())),
    relation,
  );

  return functionalDependencies;
}

function assertWithinRelation(
  operation: string,
  label: string,
  attributes: AttributeSet,
  relation: Relation,
): void {
  const externalAttributes = attributes.difference(relation.attributes);
  if (externalAttributes.size === 0) {
    return;
  }

  const externalIds = externalAttributes.toArray().map(({ id }) => id).join(", ");
  throw new Error(
    `${operation}: ${label} must be a subset of relation "${relation.name}" attributes; external attribute ids: ${externalIds}`,
  );
}
