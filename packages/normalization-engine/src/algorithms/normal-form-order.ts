import { AttributeSet } from "../domain/attribute-set.js";

export function compareAttributeSets(left: AttributeSet, right: AttributeSet): number {
  if (left.size !== right.size) {
    return left.size - right.size;
  }

  const leftIds = left.toArray().map(({ id }) => id);
  const rightIds = right.toArray().map(({ id }) => id);

  for (let index = 0; index < leftIds.length; index += 1) {
    const comparison = compareIds(leftIds[index] ?? "", rightIds[index] ?? "");
    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

export function attributeSetKey(attributes: AttributeSet): string {
  return JSON.stringify(attributes.toArray().map(({ id }) => id));
}

export function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
