import type { FunctionalDependencyDto, SchemaInputDto } from "../../api/schemawise-contracts";

export type EducationalSource = "dto" | "snapshot" | "operation-contract";

export type ContentToken =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "attribute"; readonly id: string }
  | { readonly kind: "attribute-set"; readonly ids: readonly string[] }
  | { readonly kind: "functional-dependency"; readonly dependency: FunctionalDependencyDto }
  | { readonly kind: "closure"; readonly ids: readonly string[] }
  | { readonly kind: "relation"; readonly snapshot: SchemaInputDto };

export interface ExplanationFact {
  readonly source: EducationalSource;
  readonly content: readonly ContentToken[];
}

export interface FormalReasoningContent {
  readonly rule: readonly ContentToken[];
  readonly evidence: readonly ExplanationFact[];
  readonly conclusion: readonly ContentToken[];
}

export interface EducationalExplanation {
  readonly summary: readonly ContentToken[];
  readonly formal?: FormalReasoningContent;
  readonly concepts?: readonly ("candidate-key" | "primary-key" | "prime-attribute" | "minimal-cover" | "superkey")[];
}

export const text = (value: string): ContentToken => ({ kind: "text", value });
export const attribute = (id: string): ContentToken => ({ kind: "attribute", id });
export const attributeSet = (ids: readonly string[]): ContentToken => ({ kind: "attribute-set", ids });
export const relation = (snapshot: SchemaInputDto): ContentToken => ({ kind: "relation", snapshot });
