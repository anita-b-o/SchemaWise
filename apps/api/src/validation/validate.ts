import type { DependencyPreservationRequestDto, FunctionalDependencyDto, RelationDto, SchemaInputDto } from "../contracts/dtos.js";
import { ApplicationError, applicationError } from "../errors/application-error.js";
import { MAX_ATTRIBUTES, MAX_ATTRIBUTE_ID_LENGTH, MAX_ATTRIBUTE_NAME_LENGTH, MAX_DECOMPOSITION_RELATIONS, MAX_FUNCTIONAL_DEPENDENCIES, MAX_RELATION_NAME_LENGTH } from "./limits.js";

function fail(code: ApplicationError["code"], message: string, details?: Readonly<Record<string, unknown>>): never {
  throw applicationError(code, message, details);
}

function stringValue(value: unknown, code: ApplicationError["code"], field: string): string {
  if (typeof value !== "string" || value.length === 0 || value.trim().length === 0 || value !== value.trim()) {
    fail(code, `${field} must be a non-blank string without surrounding whitespace.`, { field });
  }
  return value;
}

export function validateSchemaInput(input: SchemaInputDto): void {
  if (input === null || typeof input !== "object") fail("INVALID_REQUEST", "Request must be an object.");
  const relation = input.relation as RelationDto;
  if (relation === null || typeof relation !== "object") fail("INVALID_RELATION", "Relation is required.");
  stringValue(relation.name, "INVALID_RELATION", "relation.name");
  if (relation.name.length > MAX_RELATION_NAME_LENGTH) fail("ANALYSIS_LIMIT_EXCEEDED", "Relation name exceeds the product limit.", { limit: "maxRelationNameLength", maximum: MAX_RELATION_NAME_LENGTH, actual: relation.name.length });
  if (!Array.isArray(relation.attributes) || relation.attributes.length === 0) fail("INVALID_RELATION", "Relation must contain at least one attribute.");
  if (relation.attributes.length > MAX_ATTRIBUTES) fail("ANALYSIS_LIMIT_EXCEEDED", "Relation exceeds the product attribute limit.", { limit: "maxAttributes", maximum: MAX_ATTRIBUTES, actual: relation.attributes.length });
  const ids = new Map<string, string>();
  for (const attribute of relation.attributes) {
    if (attribute === null || typeof attribute !== "object") fail("INVALID_ATTRIBUTE", "Attribute must be an object.");
    const id = stringValue(attribute.id, "INVALID_ATTRIBUTE", "attribute.id");
    const name = stringValue(attribute.name, "INVALID_ATTRIBUTE", "attribute.name");
    if (id.length > MAX_ATTRIBUTE_ID_LENGTH) fail("ANALYSIS_LIMIT_EXCEEDED", "Attribute id exceeds the product limit.", { limit: "maxAttributeIdLength", maximum: MAX_ATTRIBUTE_ID_LENGTH, actual: id.length });
    if (name.length > MAX_ATTRIBUTE_NAME_LENGTH) fail("ANALYSIS_LIMIT_EXCEEDED", "Attribute name exceeds the product limit.", { limit: "maxAttributeNameLength", maximum: MAX_ATTRIBUTE_NAME_LENGTH, actual: name.length });
    const previous = ids.get(id);
    if (previous !== undefined) fail(previous === name ? "INVALID_ATTRIBUTE" : "ATTRIBUTE_IDENTITY_COLLISION", previous === name ? "Attribute ids must be unique." : "Two attributes use the same id with different names.", { attributeId: id });
    ids.set(id, name);
  }
  if (!Array.isArray(input.functionalDependencies)) fail("INVALID_FUNCTIONAL_DEPENDENCY", "functionalDependencies must be an array.");
  if (input.functionalDependencies.length > MAX_FUNCTIONAL_DEPENDENCIES) fail("ANALYSIS_LIMIT_EXCEEDED", "Functional dependencies exceed the product limit.", { limit: "maxFunctionalDependencies", maximum: MAX_FUNCTIONAL_DEPENDENCIES, actual: input.functionalDependencies.length });
  for (const dependency of input.functionalDependencies) validateDependency(dependency, ids);
}

function validateDependency(dependency: FunctionalDependencyDto, ids: ReadonlyMap<string, string>): void {
  if (dependency === null || typeof dependency !== "object" || !Array.isArray(dependency.left) || !Array.isArray(dependency.right)) fail("INVALID_FUNCTIONAL_DEPENDENCY", "Functional dependency sides must be arrays.");
  for (const side of [dependency.left, dependency.right]) {
    const seen = new Set<string>();
    for (const id of side) {
      if (typeof id !== "string" || seen.has(id)) fail("INVALID_FUNCTIONAL_DEPENDENCY", "Functional dependency sides must contain unique string ids.");
      seen.add(id);
      if (!ids.has(id)) fail("UNKNOWN_ATTRIBUTE_REFERENCE", "A functional dependency references an unknown attribute.", { attributeId: id });
    }
  }
}

export function validateAttributeSet(ids: readonly string[], known: ReadonlySet<string>, field: string): void {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) fail("INVALID_REQUEST", `${field} must be an array of strings.`);
  if (new Set(ids).size !== ids.length) fail("INVALID_REQUEST", `${field} must not contain duplicate ids.`);
  for (const id of ids) if (!known.has(id)) fail("UNKNOWN_ATTRIBUTE_REFERENCE", "An attribute set references an unknown attribute.", { attributeId: id });
}

export function validateDependencyPreservationInput(input: DependencyPreservationRequestDto): void {
  validateSchemaInput(input);
  if (!Array.isArray(input.decomposition)) fail("INVALID_REQUEST", "decomposition must be an array.");
  if (input.decomposition.length > MAX_DECOMPOSITION_RELATIONS) fail("ANALYSIS_LIMIT_EXCEEDED", "Decomposition exceeds the product limit.", { limit: "maxDecompositionRelations", maximum: MAX_DECOMPOSITION_RELATIONS, actual: input.decomposition.length });
  const known = new Set(input.relation.attributes.map(({ id }) => id));
  for (const attributes of input.decomposition) validateAttributeSet(attributes, known, "decomposition relation");
  const covered = new Set(input.decomposition.flat());
  if (known.size !== covered.size || [...known].some((id) => !covered.has(id))) fail("INCOMPLETE_DECOMPOSITION", "Decomposition must cover every relation attribute.");
}

