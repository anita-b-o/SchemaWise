import type { AnalysisResponseDto, BcnfDecompositionResponseDto, BcnfStepDto, DependencyPreservationResponseDto, NormalFormDto, SecondNormalFormViolationDto, ThirdNormalFormViolationDto, ThirdNormalFormSynthesisResponseDto } from "../contracts/dtos.js";
import type { AttributeSet, BoyceCoddNormalFormAnalysis, BoyceCoddNormalFormViolation, DependencyPreservationAnalysis, SecondNormalFormAnalysis, SecondNormalFormViolation, ThirdNormalFormAnalysis, ThirdNormalFormViolation, ThirdNormalFormSynthesis, BoyceCoddDecomposition } from "@schemawise/normalization-engine";
import { attributeSetToDto, functionalDependencyToDto, relationToDto } from "./domain-mappers.js";

export function normalFormToDto<V, D>(analysis: { readonly satisfied: boolean; readonly violations: readonly V[] }, map: (violation: V) => D): NormalFormDto<D> {
  return { satisfied: analysis.satisfied, violations: Object.freeze(analysis.violations.map(map)) };
}

export function secondViolationToDto(v: SecondNormalFormViolation): SecondNormalFormViolationDto {
  return { candidateKey: attributeSetToDto(v.candidateKey), determinant: attributeSetToDto(v.determinant), dependent: v.dependent.id };
}

export function thirdViolationToDto(v: ThirdNormalFormViolation | BoyceCoddNormalFormViolation): ThirdNormalFormViolationDto {
  return { determinant: attributeSetToDto(v.determinant), dependent: v.dependent.id };
}

export function analysisToDto(relation: import("@schemawise/normalization-engine").Relation, candidateKeys: readonly AttributeSet[], prime: AttributeSet, minimalCover: readonly import("@schemawise/normalization-engine").FunctionalDependency[], second: SecondNormalFormAnalysis, third: ThirdNormalFormAnalysis, bcnf: BoyceCoddNormalFormAnalysis): AnalysisResponseDto {
  return { relation: relationToDto(relation), candidateKeys: Object.freeze(candidateKeys.map(attributeSetToDto)), primeAttributes: attributeSetToDto(prime), minimalCover: Object.freeze(minimalCover.map(functionalDependencyToDto)), normalForms: { second: normalFormToDto(second, secondViolationToDto), third: normalFormToDto(third, thirdViolationToDto), bcnf: normalFormToDto(bcnf, thirdViolationToDto) } };
}

export function synthesisToDto(result: ThirdNormalFormSynthesis): ThirdNormalFormSynthesisResponseDto {
  return { relations: Object.freeze(result.relations.map(({ attributes, source }) => ({ attributes: attributeSetToDto(attributes), source }))), minimalCover: Object.freeze(result.minimalCover.map(functionalDependencyToDto)), addedCandidateKey: result.addedCandidateKey === null ? null : attributeSetToDto(result.addedCandidateKey) };
}

export function decompositionToDto(result: BoyceCoddDecomposition): BcnfDecompositionResponseDto {
  const steps: BcnfStepDto[] = result.steps.map(({ source, violation, result: pair }) => ({ source: attributeSetToDto(source), violation: thirdViolationToDto(violation), result: [attributeSetToDto(pair[0]), attributeSetToDto(pair[1])] }));
  return { relations: Object.freeze(result.relations.map(({ attributes }) => ({ attributes: attributeSetToDto(attributes) }))), steps: Object.freeze(steps) };
}

export function dependencyPreservationToDto(result: DependencyPreservationAnalysis): DependencyPreservationResponseDto {
  return { preserved: result.preserved, preservedDependencies: Object.freeze(result.preservedDependencies.map(functionalDependencyToDto)), lostDependencies: Object.freeze(result.lostDependencies.map(functionalDependencyToDto)) };
}

