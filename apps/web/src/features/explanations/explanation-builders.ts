import type { AttributeSetDto, FunctionalDependencyDto, SchemaInputDto, SecondNormalFormViolationDto, ThirdNormalFormViolationDto } from "../../api/schemawise-contracts";
import { formatAttributeSet, formatFunctionalDependency } from "../workspace/schema-formatters";
import { attribute, attributeSet, relation, text, type EducationalExplanation } from "./educational-content";
export interface Explanation { readonly label?: string; readonly dependency: string; readonly reasons: readonly string[]; }
function formatDeterminant(ids: readonly string[], lookup?: ReadonlyMap<string, string>): string { return formatAttributeSet(ids, lookup).replace(/^\{|\}$/g, ""); }
export function explainSecondNormalForm(v: SecondNormalFormViolationDto, lookup?: ReadonlyMap<string, string>): Explanation { return { label: "Partial dependency", dependency: formatFunctionalDependency({ left: v.determinant, right: [v.dependent] }, lookup), reasons: [`Candidate key: ${formatAttributeSet(v.candidateKey, lookup)}`, `Partial determinant: ${formatAttributeSet(v.determinant, lookup)}`, `Dependent non-prime attribute: ${lookup?.get(v.dependent) ?? v.dependent}`] }; }
export function explainThirdNormalForm(v: ThirdNormalFormViolationDto, prime: readonly string[], lookup?: ReadonlyMap<string, string>): Explanation { const dependent = lookup?.get(v.dependent) ?? v.dependent; return { dependency: formatFunctionalDependency({ left: v.determinant, right: [v.dependent] }, lookup), reasons: [`${formatDeterminant(v.determinant, lookup)} is not a superkey.`, `${dependent} is ${prime.includes(v.dependent) ? "a prime" : "not a prime"} attribute.`, "Therefore this dependency violates 3NF." ] }; }
export function explainBcnf(v: ThirdNormalFormViolationDto, lookup?: ReadonlyMap<string, string>): Explanation { return { dependency: formatFunctionalDependency({ left: v.determinant, right: [v.dependent] }, lookup), reasons: [`${formatDeterminant(v.determinant, lookup)} is not a superkey.`, "BCNF requires every non-trivial determinant to be a superkey.", "Therefore this dependency violates BCNF."] }; }
export const ONE_NF_NOTICE = "SchemaWise analyzes 2NF, 3NF and BCNF assuming the relation is already in 1NF.";

export function buildCandidateKeyExplanation(key: AttributeSetDto, candidateKeyCount: number, snapshot: SchemaInputDto): EducationalExplanation {
  const empty = key.length === 0;
  const composite = key.length > 1;
  const summary = empty
    ? [attributeSet(key), text(" is an empty-set candidate key. The functional dependencies determine every attribute without starting attributes, and the empty set has no proper subsets.")]
    : [attributeSet(key), text(` is returned as a ${composite ? "composite " : ""}candidate key: it is a superkey and no proper subset of it is.`)];

  return {
    summary,
    formal: {
      rule: [text("A candidate key is a minimal set of attributes that functionally determines every attribute in the relation.")],
      evidence: [
        { source: "dto", content: [text("The analysis response includes "), attributeSet(key), text(" as a candidate key.")] },
        { source: "snapshot", content: [text("The analyzed relation is "), relation(snapshot), text(".")] },
        { source: "operation-contract", content: [text("Candidate-key results are superkeys with no proper subset that is also a superkey.")] },
      ],
      conclusion: [
        text("This result is a candidate key, not a selected primary key."),
        ...(candidateKeyCount > 1 ? [text(" A relation can have multiple candidate keys; choosing a primary key is a later design decision.")] : []),
      ],
    },
    concepts: ["candidate-key", "primary-key"],
  };
}

export function buildPrimeAttributeExplanation(attributeId: string, candidateKeys: readonly AttributeSetDto[]): EducationalExplanation {
  const origins = candidateKeys.filter((key) => key.includes(attributeId));
  const originTokens = origins.flatMap((key, index) => [
    ...(index === 0 ? [] : [text(index === origins.length - 1 ? " and " : ", ")]),
    attributeSet(key),
  ]);
  const hasOrigin = origins.length > 0;

  return {
    summary: hasOrigin
      ? [attribute(attributeId), text(` is prime because it appears in ${origins.length === 1 ? "candidate key " : "candidate keys "}`), ...originTokens, text(".")]
      : [attribute(attributeId), text(" is returned as prime, but no originating candidate key is present in this response.")],
    formal: {
      rule: [text("A prime attribute belongs to at least one candidate key.")],
      evidence: [
        { source: "dto", content: [attribute(attributeId), text(" is included in the response's prime attributes.")] },
        ...(hasOrigin ? [{ source: "snapshot" as const, content: [attribute(attributeId), text(" appears in "), ...originTokens, text(".")] }] : []),
      ],
      conclusion: [text("Prime attribute does not mean primary-key attribute. No primary key has been selected here.")],
    },
    concepts: ["prime-attribute", "primary-key"],
  };
}

export function buildEmptyPrimeAttributesExplanation(candidateKeys: readonly AttributeSetDto[]): EducationalExplanation {
  const onlyEmptyKeys = candidateKeys.length > 0 && candidateKeys.every((key) => key.length === 0);
  return {
    summary: [text(onlyEmptyKeys ? "No candidate key in this result contains an attribute, so the set of prime attributes is empty." : "The analysis response returns an empty set of prime attributes.")],
    formal: {
      rule: [text("A prime attribute belongs to at least one candidate key.")],
      evidence: [{ source: "dto", content: [text("The returned prime-attribute set is "), attributeSet([]), text(".")] }],
      conclusion: [text("Prime attribute does not mean primary-key attribute. No primary key has been selected here.")],
    },
    concepts: ["prime-attribute", "primary-key"],
  };
}

export function buildMinimalCoverExplanation(minimalCover: readonly FunctionalDependencyDto[]): EducationalExplanation {
  return {
    summary: [text(minimalCover.length === 0
      ? "The returned minimal cover is empty: no non-trivial dependencies remain in the cover. This does not imply that the original input contained no dependencies."
      : "A minimal cover is an equivalent, reduced set of functional dependencies with the same implications as the original set.")],
    formal: {
      rule: [text("This result has the defining properties of a minimal cover.")],
      evidence: [
        { source: "dto", content: [text(`The response contains ${minimalCover.length} ${minimalCover.length === 1 ? "dependency" : "dependencies"} in the minimal cover.`)] },
        { source: "operation-contract", content: [text("It is equivalent to the original set of functional dependencies.")] },
        { source: "operation-contract", content: [text("Every right-hand side contains a single attribute.")] },
        { source: "operation-contract", content: [text("No left-hand-side attribute is extraneous.")] },
        { source: "operation-contract", content: [text("No functional dependency is redundant.")] },
      ],
      conclusion: [text("The operation returns these properties, not an execution trace; this view does not claim which dependency was changed or removed at any algorithm step.")],
    },
    concepts: ["minimal-cover"],
  };
}
