import { Attribute, AttributeSet, FunctionalDependency, Relation } from "@schemawise/normalization-engine";
import type { AttributeDto, FunctionalDependencyDto, RelationDto, SchemaInputDto } from "../contracts/dtos.js";
import { translateEngineError, applicationError } from "../errors/application-error.js";
import { validateAttributeSet, validateSchemaInput } from "../validation/validate.js";

export interface MappedSchema {
  readonly relation: Relation;
  readonly dependencies: readonly FunctionalDependency[];
  readonly attributesById: ReadonlyMap<string, Attribute>;
}

export function toDomainSchema(input: SchemaInputDto): MappedSchema {
  validateSchemaInput(input);
  try {
    const attributesById = new Map<string, Attribute>();
    const attributes = input.relation.attributes.map((dto) => {
      const attribute = Attribute.create(dto.id, dto.name);
      attributesById.set(attribute.id, attribute);
      return attribute;
    });
    const relation = Relation.create(input.relation.name, new AttributeSet(attributes));
    const dependencies = input.functionalDependencies.map(({ left, right }) =>
      FunctionalDependency.create(toDomainSet(left, attributesById), toDomainSet(right, attributesById)),
    );
    return { relation, dependencies: Object.freeze(dependencies), attributesById };
  } catch (error) {
    throw translateEngineError(error);
  }
}

export function toDomainSet(ids: readonly string[], attributesById: ReadonlyMap<string, Attribute>): AttributeSet {
  validateAttributeSet(ids, new Set(attributesById.keys()), "attribute set");
  const attributes = ids.map((id) => {
    const attribute = attributesById.get(id);
    if (attribute === undefined) throw applicationError("UNKNOWN_ATTRIBUTE_REFERENCE", "An attribute set references an unknown attribute.", { attributeId: id });
    return attribute;
  });
  return new AttributeSet(attributes);
}

export function attributeToDto(attribute: Attribute): AttributeDto {
  return { id: attribute.id, name: attribute.name };
}

export function attributeSetToDto(set: AttributeSet): readonly string[] {
  return Object.freeze(set.toArray().map(({ id }) => id));
}

export function relationToDto(relation: Relation): RelationDto {
  return { name: relation.name, attributes: Object.freeze(relation.attributes.toArray().map(attributeToDto)) };
}

export function functionalDependencyToDto(dependency: FunctionalDependency): FunctionalDependencyDto {
  return { left: attributeSetToDto(dependency.left), right: attributeSetToDto(dependency.right) };
}

