export class Attribute {
  private constructor(
    public readonly id: string,
    public readonly name: string,
  ) {
    Object.freeze(this);
  }

  static create(id: string, name: string): Attribute {
    const normalizedId = requireNonBlank(id, "Attribute id");
    requireNonBlank(name, "Attribute name");

    return new Attribute(normalizedId, name);
  }

  equals(other: Attribute): boolean {
    if (this.id !== other.id) {
      return false;
    }
    if (this.name !== other.name) {
      throw new Error(
        `Attribute identity conflict for id "${this.id}": names "${this.name}" and "${other.name}" differ`,
      );
    }
    return true;
  }
}

function requireNonBlank(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-blank string`);
  }

  return value.trim();
}
