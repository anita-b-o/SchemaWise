import { Attribute } from "../domain/attribute.js";

export function* attributeSubsets(
  attributes: readonly Attribute[],
  maximumSize = attributes.length,
): Generator<readonly Attribute[]> {
  for (let size = 0; size <= maximumSize; size += 1) {
    yield* attributeCombinations(attributes, size);
  }
}

export function* attributeCombinations(
  attributes: readonly Attribute[],
  size: number,
  start = 0,
  selected: readonly Attribute[] = [],
): Generator<readonly Attribute[]> {
  if (selected.length === size) {
    yield selected;
    return;
  }

  const remaining = size - selected.length;
  for (let index = start; index <= attributes.length - remaining; index += 1) {
    const attribute = attributes[index];
    if (attribute !== undefined) {
      yield* attributeCombinations(attributes, size, index + 1, [...selected, attribute]);
    }
  }
}
