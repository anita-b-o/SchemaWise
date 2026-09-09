export interface AttributeDto {
  readonly id: string;
  readonly name: string;
}

export interface RelationDto {
  readonly name: string;
  readonly attributes: readonly AttributeDto[];
}

export type AttributeSetDto = readonly string[];

export interface FunctionalDependencyDto {
  readonly left: AttributeSetDto;
  readonly right: AttributeSetDto;
}

export interface SchemaInputDto {
  readonly relation: RelationDto;
  readonly functionalDependencies: readonly FunctionalDependencyDto[];
}

export type SchemaAnalysisRequestDto = SchemaInputDto;
export type ThirdNormalFormSynthesisRequestDto = SchemaInputDto;
export type BcnfDecompositionRequestDto = SchemaInputDto;

export interface DependencyPreservationRequestDto extends SchemaInputDto {
  readonly decomposition: readonly AttributeSetDto[];
}

export interface SecondNormalFormViolationDto {
  readonly candidateKey: AttributeSetDto;
  readonly determinant: AttributeSetDto;
  readonly dependent: string;
}

export interface ThirdNormalFormViolationDto {
  readonly determinant: AttributeSetDto;
  readonly dependent: string;
}

export type BcnfViolationDto = ThirdNormalFormViolationDto;

export interface NormalFormDto<Violation> {
  readonly satisfied: boolean;
  readonly violations: readonly Violation[];
}

export interface AnalysisResponseDto {
  readonly relation: RelationDto;
  readonly candidateKeys: readonly AttributeSetDto[];
  readonly primeAttributes: AttributeSetDto;
  readonly minimalCover: readonly FunctionalDependencyDto[];
  readonly normalForms: {
    readonly second: NormalFormDto<SecondNormalFormViolationDto>;
    readonly third: NormalFormDto<ThirdNormalFormViolationDto>;
    readonly bcnf: NormalFormDto<BcnfViolationDto>;
  };
}

export interface ClosureResponseDto {
  readonly closure: AttributeSetDto;
}

export type SynthesizedRelationSource = "minimal-cover" | "candidate-key";

export interface SynthesizedRelationDto {
  readonly attributes: AttributeSetDto;
  readonly source: SynthesizedRelationSource;
}

export interface ThirdNormalFormSynthesisResponseDto {
  readonly relations: readonly SynthesizedRelationDto[];
  readonly minimalCover: readonly FunctionalDependencyDto[];
  readonly addedCandidateKey: AttributeSetDto | null;
}

export interface BcnfStepDto {
  readonly source: AttributeSetDto;
  readonly violation: BcnfViolationDto;
  readonly result: readonly [AttributeSetDto, AttributeSetDto];
}

export interface BcnfDecompositionResponseDto {
  readonly relations: readonly { readonly attributes: AttributeSetDto }[];
  readonly steps: readonly BcnfStepDto[];
}

export interface DependencyPreservationResponseDto {
  readonly preserved: boolean;
  readonly preservedDependencies: readonly FunctionalDependencyDto[];
  readonly lostDependencies: readonly FunctionalDependencyDto[];
}

