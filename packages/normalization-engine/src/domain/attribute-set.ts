import { Attribute } from "./attribute.js";

export class AttributeSet {
  readonly #values: ReadonlyMap<string, Attribute>;

  constructor(attributes: Iterable<Attribute> = []) {
    const values = new Map<string, Attribute>();
    for (const attribute of attributes) {
      const existing = values.get(attribute.id);
      if (existing !== undefined && existing.name !== attribute.name) {
        throw new Error(
          `Attribute identity conflict for id "${attribute.id}": names "${existing.name}" and "${attribute.name}" differ`,
        );
      }
      values.set(attribute.id, attribute);
    }
    this.#values = values;
    Object.freeze(this);
  }

  get size(): number {
    return this.#values.size;
  }

  has(attribute: Attribute): boolean {
    const existing = this.#values.get(attribute.id);
    if (existing !== undefined && existing.name !== attribute.name) {
      throw new Error(
        `Attribute identity conflict for id "${attribute.id}": names "${existing.name}" and "${attribute.name}" differ`,
      );
    }
    return existing !== undefined;
  }

  isSubsetOf(other: AttributeSet): boolean {
    return [...this.#values.values()].every((attribute) => other.has(attribute));
  }

  equals(other: AttributeSet): boolean {
    const isSubset = this.isSubsetOf(other);
    return this.size === other.size && isSubset;
  }

  union(other: AttributeSet): AttributeSet {
    return new AttributeSet([...this.#values.values(), ...other.#values.values()]);
  }

  difference(other: AttributeSet): AttributeSet {
    return new AttributeSet(
      [...this.#values.values()].filter((attribute) => !other.has(attribute)),
    );
  }

  toArray(): readonly Attribute[] {
    return [...this.#values.values()].sort((left, right) => left.id.localeCompare(right.id));
  }
}
