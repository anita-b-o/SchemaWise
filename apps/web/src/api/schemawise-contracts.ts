export interface AttributeDto { readonly id: string; readonly name: string; }
export interface RelationDto { readonly name: string; readonly attributes: readonly AttributeDto[]; }
export type AttributeSetDto = readonly string[];
export interface FunctionalDependencyDto { readonly left: AttributeSetDto; readonly right: AttributeSetDto; }
export interface SchemaInputDto { readonly relation: RelationDto; readonly functionalDependencies: readonly FunctionalDependencyDto[]; }
export type SchemaAnalysisRequestDto = SchemaInputDto;
export type ThirdNormalFormSynthesisRequestDto = SchemaInputDto;
export type BcnfDecompositionRequestDto = SchemaInputDto;
export interface ClosureRequestDto extends SchemaInputDto { readonly attributes: AttributeSetDto; }
export interface DependencyPreservationRequestDto extends SchemaInputDto { readonly decomposition: readonly AttributeSetDto[]; }

export interface SecondNormalFormViolationDto { readonly candidateKey: AttributeSetDto; readonly determinant: AttributeSetDto; readonly dependent: string; }
export interface ThirdNormalFormViolationDto { readonly determinant: AttributeSetDto; readonly dependent: string; }
export type BcnfViolationDto = ThirdNormalFormViolationDto;
export interface NormalFormDto<V> { readonly satisfied: boolean; readonly violations: readonly V[]; }
export interface NormalFormDiagnosticsDto {
  readonly second: NormalFormDto<SecondNormalFormViolationDto>;
  readonly third: NormalFormDto<ThirdNormalFormViolationDto>;
  readonly bcnf: NormalFormDto<BcnfViolationDto>;
}
export interface AnalysisResponseDto { readonly relation: RelationDto; readonly candidateKeys: readonly AttributeSetDto[]; readonly primeAttributes: AttributeSetDto; readonly minimalCover: readonly FunctionalDependencyDto[]; readonly normalForms: NormalFormDiagnosticsDto; }
export interface ClosureResponseDto { readonly closure: AttributeSetDto; }
export type SynthesizedRelationSource = "minimal-cover" | "candidate-key";
export interface SynthesizedRelationDto { readonly attributes: AttributeSetDto; readonly source: SynthesizedRelationSource; }
export interface ThirdNormalFormSynthesisResponseDto { readonly relations: readonly SynthesizedRelationDto[]; readonly minimalCover: readonly FunctionalDependencyDto[]; readonly addedCandidateKey: AttributeSetDto | null; }
export interface BcnfStepDto { readonly source: AttributeSetDto; readonly violation: BcnfViolationDto; readonly result: readonly [AttributeSetDto, AttributeSetDto]; }
export interface BcnfDecompositionResponseDto { readonly relations: readonly { readonly attributes: AttributeSetDto }[]; readonly steps: readonly BcnfStepDto[]; }
export interface DependencyPreservationResponseDto { readonly preserved: boolean; readonly preservedDependencies: readonly FunctionalDependencyDto[]; readonly lostDependencies: readonly FunctionalDependencyDto[]; }

export const ERROR_CODES = ["INVALID_REQUEST", "INVALID_RELATION", "INVALID_ATTRIBUTE", "INVALID_FUNCTIONAL_DEPENDENCY", "ATTRIBUTE_IDENTITY_COLLISION", "UNKNOWN_ATTRIBUTE_REFERENCE", "SCHEMA_SCOPE_VIOLATION", "INCOMPLETE_DECOMPOSITION", "ANALYSIS_LIMIT_EXCEEDED", "OPERATION_TIMEOUT", "INTERNAL_ERROR"] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export interface ErrorEnvelope { readonly error: { readonly code: ErrorCode; readonly message: string; readonly details?: Record<string, unknown>; }; }
