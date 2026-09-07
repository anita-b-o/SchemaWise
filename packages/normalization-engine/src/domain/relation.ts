import { AttributeSet } from "./attribute-set.js";

export class Relation {
  private constructor(
    public readonly name: string,
    public readonly attributes: AttributeSet,
  ) {
    Object.freeze(this);
  }

  static create(name: string, attributes: AttributeSet): Relation {
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error("Relation name must be a non-blank string");
    }
    if (attributes.size === 0) {
      throw new Error("Relation must contain at least one attribute");
    }

    return new Relation(name.trim(), attributes);
  }
}
