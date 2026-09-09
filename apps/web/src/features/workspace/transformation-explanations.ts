import type { SynthesizedRelationSource } from "../../api/schemawise-contracts";

export const TRANSFORMATION_COPY = {
  stale: "Analyze the updated schema before generating a transformation.",
  synthesisGuarantee: "By construction, this synthesis preserves the functional dependencies and produces a lossless decomposition.",
  bcnfGuarantee: "Every final relation satisfies BCNF. The decomposition is lossless.",
  bcnfPreservationCaveat: "Dependency preservation is not guaranteed by BCNF decomposition.",
  lossless: "Lossless join means the original relation can be reconstructed without losing information.",
  preservation: "Dependency preservation means the dependencies can be checked locally without recomposing relations.",
} as const;

export function synthesizedRelationSourceLabel(source: SynthesizedRelationSource): string {
  return source === "candidate-key" ? "Added to contain a candidate key" : "Derived from minimal cover";
}
