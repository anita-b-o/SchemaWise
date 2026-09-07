export interface NormalFormAnalysis<Violation> {
  readonly satisfied: boolean;
  readonly violations: readonly Violation[];
}
