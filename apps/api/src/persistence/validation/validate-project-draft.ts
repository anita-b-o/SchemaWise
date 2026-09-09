import { projectError } from "../errors/project-error.js";
import type { PersistedAttribute, PersistedFunctionalDependency, PersistedSchema, ProjectReplacement } from "../model/project.js";

const PROJECT_NAME_MAX = 120;
const RELATION_NAME_MAX = 120;
const ATTRIBUTE_ID_MAX = 64;
const ATTRIBUTE_NAME_MAX = 120;
const ATTRIBUTE_MAX = 6;
const FUNCTIONAL_DEPENDENCY_MAX = 12;

function characterLength(value: string): number {
  return Array.from(value).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function invalid(reason: string, details: Readonly<Record<string, unknown>> = {}): never {
  throw projectError("INVALID_PROJECT", "The project draft is invalid.", { reason, ...details });
}

function exceeded(limit: string, maximum: number): never {
  throw projectError("PROJECT_LIMIT_EXCEEDED", "The project draft exceeds a documented limit.", { limit, maximum });
}

function validateAttribute(value: unknown, index: number): PersistedAttribute {
  if (!isRecord(value) || !hasExactKeys(value, ["id", "name"]) || typeof value.id !== "string" || typeof value.name !== "string") {
    return invalid("INVALID_ATTRIBUTE", { field: `schema.relation.attributes[${index}]` });
  }
  if (value.id.length === 0 || value.id.trim() !== value.id) {
    return invalid("INVALID_ATTRIBUTE_ID", { field: `schema.relation.attributes[${index}].id` });
  }
  if (characterLength(value.id) > ATTRIBUTE_ID_MAX) exceeded("attributeIdLength", ATTRIBUTE_ID_MAX);
  if (characterLength(value.name) > ATTRIBUTE_NAME_MAX) exceeded("attributeNameLength", ATTRIBUTE_NAME_MAX);
  return { id: value.id, name: value.name };
}

function validateSide(value: unknown, field: string, knownIds: ReadonlySet<string>): readonly string[] {
  if (!Array.isArray(value)) return invalid("INVALID_FD_SIDE", { field });
  const seen = new Set<string>();
  return value.map((id, index) => {
    if (typeof id !== "string") return invalid("INVALID_FD_SIDE", { field: `${field}[${index}]` });
    if (!knownIds.has(id)) return invalid("UNKNOWN_ATTRIBUTE_REFERENCE", { field, attributeId: id });
    if (seen.has(id)) return invalid("DUPLICATE_ATTRIBUTE_REFERENCE", { field, attributeId: id });
    seen.add(id);
    return id;
  });
}

function validateFunctionalDependency(value: unknown, index: number, knownIds: ReadonlySet<string>): PersistedFunctionalDependency {
  if (!isRecord(value) || !hasExactKeys(value, ["left", "right"])) {
    return invalid("INVALID_FUNCTIONAL_DEPENDENCY", { field: `schema.functionalDependencies[${index}]` });
  }
  return {
    left: validateSide(value.left, `schema.functionalDependencies[${index}].left`, knownIds),
    right: validateSide(value.right, `schema.functionalDependencies[${index}].right`, knownIds),
  };
}

export function validatePersistedSchema(value: unknown): PersistedSchema {
  if (!isRecord(value) || !hasExactKeys(value, ["schemaVersion", "relation", "functionalDependencies"])) {
    return invalid("INVALID_SCHEMA", { field: "schema" });
  }
  if (value.schemaVersion !== 1) return invalid("UNSUPPORTED_SCHEMA_VERSION", { field: "schema.schemaVersion" });
  if (!isRecord(value.relation) || !hasExactKeys(value.relation, ["name", "attributes"]) || typeof value.relation.name !== "string" || !Array.isArray(value.relation.attributes)) {
    return invalid("INVALID_RELATION", { field: "schema.relation" });
  }
  if (characterLength(value.relation.name) > RELATION_NAME_MAX) exceeded("relationNameLength", RELATION_NAME_MAX);
  if (value.relation.attributes.length > ATTRIBUTE_MAX) exceeded("attributes", ATTRIBUTE_MAX);

  const attributes = value.relation.attributes.map(validateAttribute);
  const knownIds = new Set<string>();
  for (const attribute of attributes) {
    if (knownIds.has(attribute.id)) return invalid("DUPLICATE_ATTRIBUTE_ID", { field: "schema.relation.attributes", attributeId: attribute.id });
    knownIds.add(attribute.id);
  }

  if (!Array.isArray(value.functionalDependencies)) return invalid("INVALID_FUNCTIONAL_DEPENDENCIES", { field: "schema.functionalDependencies" });
  if (value.functionalDependencies.length > FUNCTIONAL_DEPENDENCY_MAX) exceeded("functionalDependencies", FUNCTIONAL_DEPENDENCY_MAX);
  const functionalDependencies = value.functionalDependencies.map((fd, index) => validateFunctionalDependency(fd, index, knownIds));

  return {
    schemaVersion: 1,
    relation: { name: value.relation.name, attributes },
    functionalDependencies,
  };
}

export function validateProjectReplacement(name: unknown, schema: unknown): ProjectReplacement {
  if (typeof name !== "string") return invalid("INVALID_PROJECT_NAME", { field: "name" });
  const normalizedName = name.trim();
  if (normalizedName.length === 0) return invalid("INVALID_PROJECT_NAME", { field: "name" });
  if (characterLength(normalizedName) > PROJECT_NAME_MAX) exceeded("projectNameLength", PROJECT_NAME_MAX);
  return { name: normalizedName, schema: validatePersistedSchema(schema) };
}
