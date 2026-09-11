import type { SynthesizedRelationSource } from "../../api/schemawise-contracts";

export const TRANSFORMATION_COPY = {
  stale: "Analyze the updated schema before generating a transformation.",
  bcnfGuarantee: "Every final relation satisfies BCNF. Each decomposition step is lossless by construction.",
  bcnfPreservationCaveat: "Dependency preservation is not guaranteed by BCNF decomposition.",
  lossless: "The original relation can be reconstructed by joining the decomposed relations without spurious or missing information.",
  preservation: "The functional dependencies can be enforced through the projected dependencies without reconstructing the original relation.",
} as const;

export function synthesizedRelationSourceLabel(source: SynthesizedRelationSource): string {
  return source === "candidate-key" ? "Added to contain a candidate key" : "Derived from minimal cover";
}
