import type { ContentToken } from "../../explanations/educational-content";
import { formatAttributeSet, formatFunctionalDependency, formatRelation } from "../schema-formatters";

interface MathematicalNotationProps {
  readonly value: Exclude<ContentToken, { readonly kind: "text" }>;
  readonly lookup?: ReadonlyMap<string, string>;
}

function readableList(values: readonly string[]): string {
  if (values.length === 0) return "the empty set";
  if (values.length === 1) return values[0]!;
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

function names(ids: readonly string[], lookup?: ReadonlyMap<string, string>): readonly string[] {
  const order = lookup ? new Map([...lookup.keys()].map((id, index) => [id, index])) : undefined;
  const orderedIds = order
    ? [...ids].sort((left, right) => (order.get(left) ?? Number.MAX_SAFE_INTEGER) - (order.get(right) ?? Number.MAX_SAFE_INTEGER))
    : ids;
  return orderedIds.map((id) => lookup?.get(id) ?? `unknown attribute ${id}`);
}

function notation(value: MathematicalNotationProps["value"], lookup?: ReadonlyMap<string, string>): { visual: string; spoken: string } {
  switch (value.kind) {
    case "attribute": {
      const name = lookup?.get(value.id) ?? `Unknown attribute (${value.id})`;
      return { visual: name, spoken: `attribute ${name}` };
    }
    case "attribute-set": {
      const setNames = names(value.ids, lookup);
      return { visual: formatAttributeSet(value.ids, lookup), spoken: value.ids.length === 0 ? "empty set" : `set containing ${readableList(setNames)}` };
    }
    case "functional-dependency": {
      const left = names(value.dependency.left, lookup);
      const right = names(value.dependency.right, lookup);
      return {
        visual: formatFunctionalDependency(value.dependency, lookup),
        spoken: `functional dependency: ${readableList(left)} functionally determines ${readableList(right)}`,
      };
    }
    case "closure": {
      const setNames = names(value.ids, lookup);
      const visualBase = value.ids.length === 0 ? "∅" : formatAttributeSet(value.ids, lookup).replace(/^\{|\}$/g, "");
      return { visual: `${visualBase}⁺`, spoken: `closure of ${readableList(setNames)}` };
    }
    case "closure-result": {
      const selectedNames = names(value.selectedIds, lookup);
      const closureNames = names(value.closureIds, lookup);
      const visualBase = value.selectedIds.length === 0 ? "∅" : formatAttributeSet(value.selectedIds, lookup).replace(/^\{|\}$/g, "");
      return {
        visual: `${visualBase}⁺ = ${formatAttributeSet(value.closureIds, lookup)}`,
        spoken: `closure of ${readableList(selectedNames)} equals ${value.closureIds.length === 0 ? "the empty set" : `set containing ${readableList(closureNames)}`}`,
      };
    }
    case "relation": {
      const attributeNames = value.snapshot.relation.attributes.map((item) => item.name);
      return { visual: formatRelation(value.snapshot), spoken: `relation ${value.snapshot.relation.name} with attributes ${readableList(attributeNames)}` };
    }
    case "relation-attributes": {
      const attributeNames = names(value.ids, lookup);
      return {
        visual: formatAttributeSet(value.ids, lookup),
        spoken: `relation with attributes ${readableList(attributeNames)}`,
      };
    }
  }
}

export function MathematicalNotation({ value, lookup }: MathematicalNotationProps) {
  const rendered = notation(value, lookup);
  return (
    <code className="mathematical-notation">
      <span aria-hidden="true">{rendered.visual}</span>
      <span className="visually-hidden">{rendered.spoken}</span>
    </code>
  );
}
