import { AttributeSet } from "./attribute-set.js";

export class FunctionalDependency {
  private constructor(
    public readonly left: AttributeSet,
    public readonly right: AttributeSet,
  ) {
    Object.freeze(this);
  }

  static create(left: AttributeSet, right: AttributeSet): FunctionalDependency {
    // Validate identity compatibility across both sides at the domain boundary.
    left.union(right);
    return new FunctionalDependency(left, right);
  }
}
