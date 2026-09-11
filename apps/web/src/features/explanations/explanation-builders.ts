import type { AttributeSetDto, BcnfDecompositionResponseDto, BcnfStepDto, ClosureResponseDto, DependencyPreservationResponseDto, FunctionalDependencyDto, SchemaInputDto, SecondNormalFormViolationDto, ThirdNormalFormSynthesisResponseDto, ThirdNormalFormViolationDto } from "../../api/schemawise-contracts";
import { formatAttributeSet, formatFunctionalDependency } from "../workspace/schema-formatters";
import { attribute, attributeSet, relation, text, type EducationalExplanation, type TransformationExplanation } from "./educational-content";
export interface Explanation { readonly label?: string; readonly dependency: string; readonly reasons: readonly string[]; readonly educational: EducationalExplanation; }
function formatDeterminant(ids: readonly string[], lookup?: ReadonlyMap<string, string>): string { return formatAttributeSet(ids, lookup).replace(/^\{|\}$/g, ""); }
export function buildSecondNormalFormExplanation(v: SecondNormalFormViolationDto, snapshot: SchemaInputDto): EducationalExplanation {
  return { summary: [text("This dependency uses only part of a candidate key to determine a non-prime attribute.")], formal: { rule: [text("Under the 1NF assumption, 2NF requires that no non-prime attribute be functionally dependent on a proper subset of a candidate key.")], evidence: [
    { source: "dto", content: [attributeSet(v.candidateKey), text(" is a candidate key in the analysis response.")] },
    { source: "snapshot", content: [attributeSet(v.determinant), text(" is a proper subset of "), attributeSet(v.candidateKey), text(" in the analyzed relation "), relation(snapshot), text(".")] },
    { source: "dto", content: [attribute(v.dependent), text(" is the non-prime dependent reported by this violation.")] },
    { source: "dto", content: [{ kind: "functional-dependency", dependency: { left: v.determinant, right: [v.dependent] } }, text(" represents a partial dependency.")] },
  ], conclusion: [text("Because the determinant is a proper subset of the candidate key and the dependent is non-prime, this partial dependency violates 2NF.")] }, concepts: ["candidate-key", "prime-attribute"] };
}
export function explainSecondNormalForm(v: SecondNormalFormViolationDto, lookup: ReadonlyMap<string, string>, snapshot: SchemaInputDto): Explanation { return { label: "Partial dependency", dependency: formatFunctionalDependency({ left: v.determinant, right: [v.dependent] }, lookup), reasons: [`Candidate key: ${formatAttributeSet(v.candidateKey, lookup)}`, `Partial determinant: ${formatAttributeSet(v.determinant, lookup)}`, `Dependent non-prime attribute: ${lookup.get(v.dependent) ?? v.dependent}`], educational: buildSecondNormalFormExplanation(v, snapshot) }; }
export function buildThirdNormalFormExplanation(v: ThirdNormalFormViolationDto, snapshot: SchemaInputDto): EducationalExplanation { return { summary: [text("This non-trivial dependency violates 3NF because its determinant is not a superkey and its dependent is not prime.")], formal: { rule: [text("For every non-trivial dependency, the determinant is a superkey or the dependent is a prime attribute.")], evidence: [
    { source: "dto", content: [{ kind: "functional-dependency", dependency: { left: v.determinant, right: [v.dependent] } }, text(" is a non-trivial dependency, as reported by the diagnostic.")] },
    { source: "operation-contract", content: [attributeSet(v.determinant), text(" is not a superkey, and "), attribute(v.dependent), text(" is not prime for this violation.")] },
    { source: "snapshot", content: [text("The names are resolved from the analyzed relation "), relation(snapshot), text(".")] },
  ], conclusion: [text("Neither 3NF condition is true, so this dependency violates 3NF.")] }, concepts: ["superkey", "prime-attribute"] } as EducationalExplanation; }
export function explainThirdNormalForm(v: ThirdNormalFormViolationDto, prime: readonly string[], lookup: ReadonlyMap<string, string>, snapshot: SchemaInputDto): Explanation { const dependent = lookup.get(v.dependent) ?? v.dependent; return { dependency: formatFunctionalDependency({ left: v.determinant, right: [v.dependent] }, lookup), reasons: [`${formatDeterminant(v.determinant, lookup)} is not a superkey.`, `${dependent} is ${prime.includes(v.dependent) ? "a prime" : "not a prime"} attribute.`, "Therefore this dependency violates 3NF." ], educational: buildThirdNormalFormExplanation(v, snapshot) }; }
export function buildBcnfExplanation(v: ThirdNormalFormViolationDto, snapshot: SchemaInputDto): EducationalExplanation { return { summary: [text("This non-trivial dependency violates BCNF because its determinant is not a superkey.")], formal: { rule: [text("For every non-trivial dependency, the determinant must be a superkey.")], evidence: [
    { source: "dto", content: [{ kind: "functional-dependency", dependency: { left: v.determinant, right: [v.dependent] } }, text(" is a non-trivial dependency, as reported by the diagnostic.")] },
    { source: "operation-contract", content: [attributeSet(v.determinant), text(" is not a superkey.")] },
    { source: "snapshot", content: [text("The names are resolved from the analyzed relation "), relation(snapshot), text(".")] },
  ], conclusion: [text("BCNF requires every determinant of a non-trivial dependency to be a superkey, so this dependency violates BCNF.")] }, concepts: ["superkey"] }; }
export function explainBcnf(v: ThirdNormalFormViolationDto, lookup: ReadonlyMap<string, string>, snapshot: SchemaInputDto): Explanation { return { dependency: formatFunctionalDependency({ left: v.determinant, right: [v.dependent] }, lookup), reasons: [`${formatDeterminant(v.determinant, lookup)} is not a superkey.`, "BCNF requires every non-trivial determinant to be a superkey.", "Therefore this dependency violates BCNF."], educational: buildBcnfExplanation(v, snapshot) }; }
export const SECOND_NF_SATISFIED = "No partial dependency of a non-prime attribute on a proper subset of a candidate key was found.";
export const THIRD_NF_SATISFIED = "Every non-trivial implied dependency satisfies the superkey-or-prime condition.";
export const BCNF_SATISFIED = "Every determinant of a non-trivial implied dependency is a superkey.";
export const SECOND_TO_THIRD_CONTEXT = "This is possible because 2NF only rules out partial dependencies on candidate keys, while 3NF also restricts other non-trivial dependencies.";
export const THIRD_TO_BCNF_CONTEXT = "This relation satisfies 3NF but not BCNF because 3NF allows a non-superkey determinant when the dependent is prime. BCNF does not allow that exception.";
export function buildNormalFormContext(kind: "second-to-third" | "third-to-bcnf"): EducationalExplanation { return { summary: [text(kind === "second-to-third" ? SECOND_TO_THIRD_CONTEXT : THIRD_TO_BCNF_CONTEXT)] }; }
export const ONE_NF_NOTICE = "SchemaWise analyzes 2NF, 3NF and BCNF assuming the relation is already in 1NF.";

export interface ClosureExplanation {
  readonly determined: readonly string[];
  readonly missing: readonly string[];
  readonly determinesAllAttributes: boolean;
  readonly educational: EducationalExplanation;
}

export function buildClosureExplanation(selected: AttributeSetDto, response: ClosureResponseDto, snapshot: SchemaInputDto): ClosureExplanation {
  const closureIds = new Set(response.closure);
  const relationIds = snapshot.relation.attributes.map((item) => item.id);
  const determined = relationIds.filter((id) => closureIds.has(id));
  const missing = relationIds.filter((id) => !closureIds.has(id));
  const determinesAllAttributes = relationIds.every((id) => closureIds.has(id));
  const coverageConclusion = determinesAllAttributes
    ? "This closure contains every attribute in the analyzed relation, so the selected set is a superkey."
    : "This closure does not contain every attribute in the relation, so the selected set is not a superkey.";
  const coverageEvidence = determinesAllAttributes
    ? [text("Every relation attribute is present in the returned closure.")]
    : [text("The returned closure is missing "), attributeSet(missing), text(" from the captured relation.")];

  return {
    determined,
    missing,
    determinesAllAttributes,
    educational: {
      summary: [
        text("The closure of "),
        attributeSet(selected),
        text(", written "),
        { kind: "closure", ids: selected },
        text(", is the set of attributes functionally determined by it under the current functional dependencies."),
      ],
      formal: {
        rule: [text("A set is a superkey if and only if all attributes of the relation are contained in its closure.")],
        evidence: [
          { source: "snapshot", content: [text("The selected set is "), attributeSet(selected), text(" in the captured relation "), relation(snapshot), text(".")] },
          { source: "dto", content: [text("The closure response is "), { kind: "closure-result", selectedIds: selected, closureIds: response.closure }, text(".")] },
          { source: "dto+snapshot", content: coverageEvidence },
        ],
        conclusion: [text(`${coverageConclusion} If a set is a superkey and no proper subset is also a superkey, then it is a candidate key.`)],
      },
      concepts: ["superkey", "candidate-key"],
    },
  };
}

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

export function buildThirdNormalFormSynthesisExplanation(
  response: ThirdNormalFormSynthesisResponseDto,
  snapshot: SchemaInputDto,
): TransformationExplanation {
  const relationEvidence = response.relations.map(({ attributes, source }) => ({
    source: "dto" as const,
    content: [
      attributeSet(attributes),
      text(source === "minimal-cover" ? " is returned with minimal-cover provenance." : " is returned with candidate-key provenance."),
    ],
  }));
  const addedKeyEvidence = response.addedCandidateKey === null
    ? [{ source: "dto" as const, content: [text("The response reports that no additional candidate-key relation was required.")] }]
    : [{ source: "dto" as const, content: [text("The response reports the added candidate key as "), attributeSet(response.addedCandidateKey), text(".")] }];

  return {
    summary: [text("Relations marked as minimal-cover come from the synthesis basis and support preservation of that cover. A candidate-key relation appears only when the synthesis needed one to complete its lossless construction.")],
    rule: [text("3NF synthesis uses the returned minimal cover as its basis and adds a candidate-key relation only when no synthesized relation already contains a candidate key.")],
    guaranteedByAlgorithm: [
      { source: "operation-contract", content: [text("Every final relation is in third normal form by construction.")] },
      { source: "operation-contract", content: [text("The decomposition is dependency preserving.")] },
      { source: "operation-contract", content: [text("The decomposition has a lossless join.")] },
    ],
    usedEvidence: [
      { source: "dto", content: [text(`The response returns ${response.minimalCover.length} ${response.minimalCover.length === 1 ? "dependency" : "dependencies"} in the minimal cover used for synthesis.`)] },
      ...relationEvidence,
      ...addedKeyEvidence,
      { source: "snapshot", content: [text("Attribute names come from the analyzed relation "), relation(snapshot), text(".")] },
      { source: "derived-presentation", content: [text("Relation numbering follows the response order and is only a presentation label.")] },
    ],
    conclusion: [text("These are guarantees of the synthesis operation, not results of independent 3NF, preservation, or lossless-join checkers in the browser.")],
  };
}

export function buildBcnfDecompositionExplanation(
  response: BcnfDecompositionResponseDto,
  snapshot: SchemaInputDto,
): TransformationExplanation {
  return {
    summary: [text("BCNF decomposition prioritizes the stronger normal form and a lossless decomposition. Dependency preservation is a separate property and is not guaranteed.")],
    rule: [text("The algorithm repeatedly uses a reported BCNF violation to split its source relation, preserving the response order of those steps.")],
    guaranteedByAlgorithm: [
      { source: "operation-contract", content: [text("Every final relation returned by the decomposition satisfies BCNF.")] },
      { source: "operation-contract", content: [text("Each binary decomposition step is lossless by construction, so the complete decomposition has a lossless join.")] },
    ],
    usedEvidence: [
      { source: "dto", content: [text(`The response returns ${response.relations.length} final ${response.relations.length === 1 ? "relation" : "relations"} and ${response.steps.length} ordered decomposition ${response.steps.length === 1 ? "step" : "steps"}.`)] },
      { source: "snapshot", content: [text("The source names use the analyzed relation "), relation(snapshot), text(".")] },
      { source: "derived-presentation", content: [text("Step and relation numbering follows response order and does not create new schema identities.")] },
    ],
    conclusion: [text("Dependency preservation is not implied by lossless join and must be checked separately.")],
  };
}

export function buildBcnfStepExplanation(step: BcnfStepDto, snapshot: SchemaInputDto): EducationalExplanation {
  const dependency: FunctionalDependencyDto = { left: step.violation.determinant, right: [step.violation.dependent] };
  const sourceIds = new Set(step.source);
  const sourceToken = sourceIds.size === snapshot.relation.attributes.length && snapshot.relation.attributes.every(({ id }) => sourceIds.has(id))
    ? relation(snapshot)
    : { kind: "relation-attributes" as const, ids: step.source };
  return {
    summary: [
      { kind: "functional-dependency", dependency },
      text(" violates BCNF because its determinant is not a superkey. The source relation is therefore decomposed into two smaller relations."),
    ],
    formal: {
      rule: [
        text("For the reported singleton dependent "), attributeSet([step.violation.dependent]),
        text(", the contractual binary rule is: relation one = X union Y; relation two = R minus (Y minus X). The displayed results come from the response."),
      ],
      evidence: [
        { source: "dto", content: [text("Source: "), sourceToken, text(".")] },
        { source: "dto", content: [text("Violation: "), { kind: "functional-dependency", dependency }, text("; its determinant is reported as non-superkey by the BCNF diagnostic.")] },
        { source: "dto", content: [text("Relation one: "), attributeSet(step.result[0]), text(". Relation two: "), attributeSet(step.result[1]), text(".")] },
      ],
      conclusion: [text("This algorithm uses the violation determinant as the overlap condition for a lossless binary step; the browser displays the returned pair and does not run a chase or independently recompute it.")],
    },
    concepts: ["superkey"],
  };
}

export function buildDependencyPreservationExplanation(
  response: DependencyPreservationResponseDto,
): TransformationExplanation {
  return {
    summary: [text(response.preserved
      ? "The dependencies can be enforced using the decomposed relations without reconstructing the original relation."
      : "At least one dependency cannot be enforced from the projected dependencies of the decomposed relations alone. This does not mean that data was lost.")],
    rule: [text("Conceptually, dependency preservation is checked by projecting F onto each relation, combining those projected dependencies, and checking whether the original minimal-cover dependencies follow. This describes the operation contract, not a request execution trace.")],
    guaranteedByAlgorithm: [],
    usedEvidence: [
      { source: "dto", content: [text(`The checker returned ${response.preserved ? "Preserved" : "Not preserved"}.`)] },
      { source: "dto", content: [text(`It returned ${response.lostDependencies.length} lost and ${response.preservedDependencies.length} preserved minimal-cover ${response.lostDependencies.length + response.preservedDependencies.length === 1 ? "dependency" : "dependencies"}.`)] },
    ],
    conclusion: [text("The response does not expose the concrete projections, so this explanation does not assign a dependency to a particular final relation.")],
  };
}
