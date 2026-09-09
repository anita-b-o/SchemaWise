import type { BcnfDecompositionResponseDto, DependencyPreservationResponseDto, SchemaInputDto } from "../../../api/schemawise-contracts";
import type { TransformationState } from "../workspace-reducer";
import { formatAttributeSet, formatDecompositionSource, formatFunctionalDependency } from "../schema-formatters";
import { TRANSFORMATION_COPY } from "../transformation-explanations";
import { DependencyPreservationResult } from "./DependencyPreservationResult";

interface BcnfResultProps {
  readonly result: BcnfDecompositionResponseDto;
  readonly snapshot: SchemaInputDto;
  readonly outOfDate: boolean;
  readonly preservation: TransformationState<DependencyPreservationResponseDto>;
  readonly preservationError?: string | undefined;
  readonly onCheckPreservation: () => void;
}

export function BcnfResult({ result, snapshot, outOfDate, preservation, preservationError, onCheckPreservation }: BcnfResultProps) {
  const lookup = new Map(snapshot.relation.attributes.map((attribute) => [attribute.id, attribute.name]));
  const isLoading = preservation.status === "loading";

  return (
    <section className="transformation-result" aria-labelledby="bcnf-result-heading">
      <h4 id="bcnf-result-heading">BCNF decomposition</h4>
      <h5>Final relations</h5>
      <div className="final-relations">
        {result.relations.map((relation, index) => <code key={`${relation.attributes.join(":")}:${index}`}>{formatAttributeSet(relation.attributes, lookup)}</code>)}
      </div>

      <div className="decomposition-steps">
        <h5>Decomposition steps</h5>
        <ol>
          {result.steps.map((step, index) => (
            <li key={`${step.source.join(":")}:${index}`}>
              <strong>Step {index + 1}</strong>
              <dl>
                <div><dt>Source</dt><dd><code>{formatDecompositionSource(step.source, snapshot, lookup)}</code></dd></div>
                <div><dt>Violation</dt><dd><code>{formatFunctionalDependency({ left: step.violation.determinant, right: [step.violation.dependent] }, lookup)}</code></dd></div>
                <div><dt>Result</dt><dd><code>{formatAttributeSet(step.result[0], lookup)}</code><code>{formatAttributeSet(step.result[1], lookup)}</code></dd></div>
              </dl>
            </li>
          ))}
        </ol>
      </div>

      <div className="guarantee-note">
        <p><strong>{TRANSFORMATION_COPY.bcnfGuarantee}</strong></p>
        <p>{TRANSFORMATION_COPY.bcnfPreservationCaveat}</p>
      </div>
      <details className="result-disclosure property-explanation">
        <summary>Lossless join vs dependency preservation</summary>
        <p><strong>Lossless join:</strong> {TRANSFORMATION_COPY.lossless}</p>
        <p><strong>Dependency preservation:</strong> {TRANSFORMATION_COPY.preservation}</p>
      </details>

      <div className="preservation-action" aria-busy={isLoading}>
        <button className="button button--secondary" type="button" onClick={onCheckPreservation} disabled={outOfDate} aria-describedby={outOfDate ? "stale-transformation-help" : undefined}>
          {isLoading ? "Checking dependency preservation…" : preservation.data ? "Check dependency preservation again" : "Check dependency preservation"}
        </button>
        <div className="transformation-live-status" role="status" aria-live="polite">{isLoading ? (preservation.data ? "Updating dependency preservation…" : "Checking dependency preservation…") : ""}</div>
        {preservationError ? <div className="transformation-error" role="alert"><strong>Unable to check dependency preservation.</strong><p>{preservationError}</p></div> : null}
      </div>
      {preservation.data ? <DependencyPreservationResult result={preservation.data} snapshot={snapshot} /> : null}
    </section>
  );
}
