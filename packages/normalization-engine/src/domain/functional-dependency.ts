import { AttributeSet } from "./attribute-set.js";

export class FunctionalDependency {
  private constructor(
    public readonly left: AttributeSet,
    public readonly right: AttributeSet,
  ) {
    Object.freeze(this);
  }

  static create(left: AttributeSet, right: AttributeSet): FunctionalDependency {
    return new FunctionalDependency(left, right);
  }
}
