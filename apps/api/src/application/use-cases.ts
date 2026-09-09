import { analyzeBoyceCoddNormalForm, analyzeDependencyPreservation, analyzeSecondNormalForm, analyzeThirdNormalForm, attributeClosure, decomposeToBoyceCoddNormalForm, findCandidateKeys, findMinimalCover, findPrimeAttributes, synthesizeThirdNormalForm as synthesizeEngine } from "@schemawise/normalization-engine";
import type { AnalysisResponseDto, ClosureResponseDto, DependencyPreservationRequestDto, DependencyPreservationResponseDto, SchemaAnalysisRequestDto, ThirdNormalFormSynthesisResponseDto, BcnfDecompositionResponseDto } from "../contracts/dtos.js";
import { toDomainSchema, toDomainSet } from "../mappers/domain-mappers.js";
import { analysisToDto, decompositionToDto, dependencyPreservationToDto, synthesisToDto } from "../mappers/response-mappers.js";
import { validateAttributeSet, validateDependencyPreservationInput } from "../validation/validate.js";
import { translateEngineError } from "../errors/application-error.js";

function safely<T>(operation: () => T): T {
  try { return operation(); } catch (error) { throw translateEngineError(error); }
}

export function analyzeSchema(input: SchemaAnalysisRequestDto): AnalysisResponseDto {
  const { relation, dependencies } = toDomainSchema(input);
  return safely(() => analysisToDto(relation, findCandidateKeys(relation, dependencies), findPrimeAttributes(relation, dependencies), findMinimalCover(relation, dependencies), analyzeSecondNormalForm(relation, dependencies), analyzeThirdNormalForm(relation, dependencies), analyzeBoyceCoddNormalForm(relation, dependencies)));
}

export function calculateClosure(input: SchemaAnalysisRequestDto & { readonly attributes: readonly string[] }): ClosureResponseDto {
  const { relation, dependencies, attributesById } = toDomainSchema(input);
  validateAttributeSet(input.attributes, new Set(attributesById.keys()), "attributes");
  return safely(() => ({ closure: requireSetDto(attributeClosure(toDomainSet(input.attributes, attributesById), dependencies)) }));
}

function requireSetDto(set: import("@schemawise/normalization-engine").AttributeSet): readonly string[] {
  return Object.freeze(set.toArray().map(({ id }) => id));
}

export function synthesizeThirdNormalForm(input: SchemaAnalysisRequestDto): ThirdNormalFormSynthesisResponseDto {
  const { relation, dependencies } = toDomainSchema(input);
  return safely(() => synthesisToDto(synthesizeEngine(relation, dependencies)));
}

export function decomposeBoyceCodd(input: SchemaAnalysisRequestDto): BcnfDecompositionResponseDto {
  const { relation, dependencies } = toDomainSchema(input);
  return safely(() => decompositionToDto(decomposeToBoyceCoddNormalForm(relation, dependencies)));
}

export function analyzeDependencyPreservationUseCase(input: DependencyPreservationRequestDto): DependencyPreservationResponseDto {
  validateDependencyPreservationInput(input);
  const { relation, dependencies, attributesById } = toDomainSchema(input);
  const decomposition = input.decomposition.map((attributes) => toDomainSet(attributes, attributesById));
  return safely(() => dependencyPreservationToDto(analyzeDependencyPreservation(relation, dependencies, decomposition)));
}
