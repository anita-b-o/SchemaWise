import type { FunctionalDependencyDto } from "../../api/schemawise-contracts";
import type { SchemaDraft } from "./workspace-reducer";
export interface ValidationIssue { readonly field: string; readonly message: string; }
export function sameFunctionalDependency(a: FunctionalDependencyDto, b: FunctionalDependencyDto): boolean { return setEqual(a.left, b.left) && setEqual(a.right, b.right); }
function setEqual(a: readonly string[], b: readonly string[]) { return a.length === b.length && new Set(a).size === new Set([...a, ...b]).size; }
export function validateDraft(draft: SchemaDraft): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [], names = new Map<string, string>();
  if (!draft.relationName.trim()) issues.push({ field: "relationName", message: "Relation name is required." });
  if (draft.attributes.length < 1 || draft.attributes.length > 6) issues.push({ field: "attributes", message: "Use between 1 and 6 attributes." });
  for (const attribute of draft.attributes) { const key = attribute.name.trim().toLocaleLowerCase(); if (!key) issues.push({ field: `attribute:${attribute.id}`, message: "Attribute name is required." }); else if (names.has(key)) issues.push({ field: `attribute:${attribute.id}`, message: "Attribute names must be unique ignoring case and surrounding whitespace." }); else names.set(key, attribute.id); }
  if (draft.functionalDependencies.length > 12) issues.push({ field: "functionalDependencies", message: "Use at most 12 functional dependencies." });
  const ids = new Set(draft.attributes.map((a) => a.id));
  for (const [index, fd] of draft.functionalDependencies.entries()) { if ([...fd.left, ...fd.right].some((id) => !ids.has(id))) issues.push({ field: `functionalDependency:${index}`, message: "Functional dependency references an unknown attribute." }); if (draft.functionalDependencies.some((other, i) => i < index && sameFunctionalDependency(fd, other))) issues.push({ field: `functionalDependency:${index}`, message: "Duplicate functional dependency." }); }
  return issues;
}
