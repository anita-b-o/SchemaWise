export { attributeClosure } from "./algorithms/attribute-closure.js";
export { findCandidateKeys } from "./algorithms/candidate-key-discovery.js";
export { findMinimalCover } from "./algorithms/minimal-cover.js";
export { projectFunctionalDependencies } from "./algorithms/functional-dependency-projection.js";
export {
  analyzeDependencyPreservation,
  type DependencyPreservationAnalysis,
} from "./algorithms/dependency-preservation.js";
export { findPrimeAttributes } from "./algorithms/prime-attributes.js";
export {
  analyzeSecondNormalForm,
  type SecondNormalFormAnalysis,
  type SecondNormalFormViolation,
} from "./algorithms/second-normal-form.js";
export { isSuperkey } from "./algorithms/superkey-detection.js";
export {
  analyzeThirdNormalForm,
  type ThirdNormalFormAnalysis,
  type ThirdNormalFormViolation,
} from "./algorithms/third-normal-form.js";
export {
  synthesizeThirdNormalForm,
  type SynthesizedRelation,
  type SynthesizedRelationSource,
  type ThirdNormalFormSynthesis,
} from "./algorithms/third-normal-form-synthesis.js";
export {
  analyzeBoyceCoddNormalForm,
  type BoyceCoddNormalFormAnalysis,
  type BoyceCoddNormalFormViolation,
} from "./algorithms/boyce-codd-normal-form.js";
export {
  decomposeToBoyceCoddNormalForm,
  type BcnfDecompositionStep,
  type BcnfRelation,
  type BoyceCoddDecomposition,
} from "./algorithms/boyce-codd-decomposition.js";
export { Attribute } from "./domain/attribute.js";
export { AttributeSet } from "./domain/attribute-set.js";
export { FunctionalDependency } from "./domain/functional-dependency.js";
export { Relation } from "./domain/relation.js";
