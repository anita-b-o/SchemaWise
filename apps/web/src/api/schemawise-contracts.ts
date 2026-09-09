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

// Authentication and persistence DTOs intentionally mirror HTTP/OpenAPI. They
// do not import application or persistence types from apps/api.
export interface UserDto { readonly id: string; readonly email: string; }
export interface AuthResponseDto { readonly user: UserDto; readonly csrfToken: string; }
export const AUTH_ERROR_CODES = ["INVALID_AUTH_REQUEST", "EMAIL_ALREADY_EXISTS", "INVALID_CREDENTIALS", "UNAUTHENTICATED", "INVALID_CSRF_TOKEN", "AUTH_RATE_LIMITED", "AUTH_INTERNAL_ERROR"] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
export interface AuthError { readonly code: AuthErrorCode; readonly message: string; readonly details?: Record<string, unknown>; }

export interface PersistedSchemaDto {
  readonly schemaVersion: 1;
  readonly relation: RelationDto;
  readonly functionalDependencies: readonly FunctionalDependencyDto[];
}
export interface ProjectDto { readonly id: string; readonly name: string; readonly schema: PersistedSchemaDto; readonly revision: number; readonly createdAt: string; readonly updatedAt: string; }
export interface ProjectSummaryDto { readonly id: string; readonly name: string; readonly relationName: string; readonly attributeCount: number; readonly functionalDependencyCount: number; readonly revision: number; readonly createdAt: string; readonly updatedAt: string; }
export interface ProjectListResponseDto { readonly projects: readonly ProjectSummaryDto[]; readonly total: number; readonly limit: number; readonly offset: number; }
export interface CreateProjectRequestDto { readonly name: string; readonly schema: PersistedSchemaDto; }
export interface UpdateProjectRequestDto extends CreateProjectRequestDto { readonly expectedRevision: number; }
export const PROJECT_ERROR_CODES = ["INVALID_PROJECT", "PROJECT_NOT_FOUND", "PROJECT_REVISION_CONFLICT", "PROJECT_LIMIT_EXCEEDED", "PERSISTENCE_ERROR"] as const;
export type ProjectErrorCode = (typeof PROJECT_ERROR_CODES)[number];
