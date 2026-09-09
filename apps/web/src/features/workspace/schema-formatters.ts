import type { AttributeSetDto, FunctionalDependencyDto, SchemaInputDto } from "../../api/schemawise-contracts";
export function formatAttributeSet(ids: AttributeSetDto, lookup?: ReadonlyMap<string, string> | Record<string, string>): string {
  if (!ids.length) return "∅";
  const name = (id: string) => lookup instanceof Map ? lookup.get(id) ?? id : lookup ? (lookup as Record<string, string>)[id] ?? id : id;
  const order = lookup instanceof Map ? new Map([...lookup.keys()].map((id, index) => [id, index])) : undefined;
  const orderedIds = order
    ? [...ids].sort((left, right) => (order.get(left) ?? Number.MAX_SAFE_INTEGER) - (order.get(right) ?? Number.MAX_SAFE_INTEGER))
    : ids;
  return `{${orderedIds.map(name).join(", ")}}`;
}
export function formatFunctionalDependency(fd: FunctionalDependencyDto, lookup?: ReadonlyMap<string, string> | Record<string, string>): string { return `${formatAttributeSet(fd.left, lookup).replace(/^\{|\}$/g, "")} → ${formatAttributeSet(fd.right, lookup).replace(/^\{|\}$/g, "")}`.replace("∅ →", "∅ →"); }
export function formatClosure(ids: AttributeSetDto, lookup?: ReadonlyMap<string, string> | Record<string, string>): string { return formatAttributeSet(ids, lookup); }
export function formatRelation(snapshot: SchemaInputDto): string { return `${snapshot.relation.name}(${snapshot.relation.attributes.map((attribute) => attribute.name).join(", ")})`; }
export function formatDecompositionSource(ids: AttributeSetDto, snapshot: SchemaInputDto, lookup?: ReadonlyMap<string, string> | Record<string, string>): string {
  const source = new Set(ids);
  const isOriginalRelation = source.size === snapshot.relation.attributes.length && snapshot.relation.attributes.every((attribute) => source.has(attribute.id));
  return isOriginalRelation ? formatRelation(snapshot) : formatAttributeSet(ids, lookup);
}
