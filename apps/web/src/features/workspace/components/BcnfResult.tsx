import type { BcnfDecompositionResponseDto, DependencyPreservationResponseDto, SchemaInputDto } from "../../../api/schemawise-contracts";
import { buildBcnfDecompositionExplanation, buildBcnfStepExplanation } from "../../explanations/explanation-builders";
import type { TransformationState } from "../workspace-reducer";
import { TRANSFORMATION_COPY } from "../transformation-explanations";
import { DependencyPreservationResult } from "./DependencyPreservationResult";
import { Content, EducationalExplanationView, FormalReasoning, TransformationReasoning } from "./EducationalAnalysis";
import { MathematicalNotation } from "./MathematicalNotation";

interface BcnfResultProps {
  readonly result: BcnfDecompositionResponseDto;
  readonly snapshot: SchemaInputDto;
  readonly outOfDate: boolean;
  readonly preservation: TransformationState<DependencyPreservationResponseDto>;
  readonly preservationError?: string | undefined;
  readonly onCheckPreservation: () => void;
  readonly onViewDiagram: () => void;
}

export function BcnfResult({ result, snapshot, outOfDate, preservation, preservationError, onCheckPreservation, onViewDiagram }: BcnfResultProps) {
  const lookup = new Map(snapshot.relation.attributes.map((attribute) => [attribute.id, attribute.name]));
  const isLoading = preservation.status === "loading";
  const explanation = buildBcnfDecompositionExplanation(result, snapshot);
  const stepExplanations = result.steps.map((step) => buildBcnfStepExplanation(step, snapshot));

  return (
    <section className="transformation-result" aria-labelledby="bcnf-result-heading">
      <h5 id="bcnf-result-heading">Decomposition result</h5>
      <h6>Final relations</h6>
      <div className="final-relations">
        {result.relations.map((relation, index) => <MathematicalNotation key={`${relation.attributes.join(":")}:${index}`} value={{ kind: "attribute-set", ids: relation.attributes }} lookup={lookup} />)}
      </div>
      <p className="transformation-properties">{result.steps.length} decomposition {result.steps.length === 1 ? "step" : "steps"} <span aria-hidden="true">·</span> <strong>Lossless join</strong></p>
      <div className="result-actions">
        <button className="button button--quiet" type="button" onClick={onViewDiagram}>View diagram</button>
      </div>

      <details className="result-disclosure decomposition-steps">
        <summary>View decomposition steps <span className="violation-count">{result.steps.length}</span></summary>
        <ol>
          {result.steps.map((step, index) => {
            const sourceIds = new Set(step.source);
            const sourceNotation = sourceIds.size === snapshot.relation.attributes.length && snapshot.relation.attributes.every(({ id }) => sourceIds.has(id))
              ? { kind: "relation" as const, snapshot }
              : { kind: "relation-attributes" as const, ids: step.source };
            return <li key={`${step.source.join(":")}:${index}`}>
              <strong>Step {index + 1}</strong>
              <dl>
                <div><dt>Source</dt><dd><MathematicalNotation value={sourceNotation} lookup={lookup} /></dd></div>
                <div><dt>Violation</dt><dd><MathematicalNotation value={{ kind: "functional-dependency", dependency: { left: step.violation.determinant, right: [step.violation.dependent] } }} lookup={lookup} /></dd></div>
                <div><dt>Result</dt><dd><span className="relation-pair"><span>Relation one</span><MathematicalNotation value={{ kind: "attribute-set", ids: step.result[0] }} lookup={lookup} /></span><span className="relation-pair"><span>Relation two</span><MathematicalNotation value={{ kind: "attribute-set", ids: step.result[1] }} lookup={lookup} /></span></dd></div>
              </dl>
              <details className="formal-reasoning-disclosure">
                <summary>Why was this relation split? <span className="visually-hidden">Step {index + 1}</span></summary>
                <EducationalExplanationView explanation={stepExplanations[index]!} lookup={lookup} includeFormal={false} />
              </details>
              <details className="formal-reasoning-disclosure">
                <summary>Formal reasoning <span className="visually-hidden">for decomposition step {index + 1}</span></summary>
                <FormalReasoning content={stepExplanations[index]!.formal!} lookup={lookup} />
              </details>
            </li>;
          })}
        </ol>
      </details>

      <details className="result-disclosure educational-disclosure result-explanation property-explanation">
        <summary>Explain decomposition</summary>
        <div className="educational-disclosure__content">
          <p className="explanation-label"><strong>Why this result</strong></p>
          <p><Content tokens={explanation.summary} lookup={lookup} /></p>
          <div className="guarantee-note">
            <p><strong>Guaranteed by this algorithm</strong></p>
            <p>{TRANSFORMATION_COPY.bcnfGuarantee}</p>
            <p>{TRANSFORMATION_COPY.bcnfPreservationCaveat}</p>
          </div>
          <p><strong>Lossless join:</strong> {TRANSFORMATION_COPY.lossless}</p>
          <p><strong>Dependency preservation:</strong> {TRANSFORMATION_COPY.preservation}</p>
          <p><strong>They are different properties:</strong> a BCNF decomposition can be lossless and still not preserve every dependency.</p>
          <details className="result-disclosure formal-reasoning-disclosure">
            <summary>Formal reasoning</summary>
            <TransformationReasoning explanation={explanation} lookup={lookup} />
          </details>
        </div>
      </details>

      <div className="preservation-action" aria-busy={isLoading}>
        <button className="button button--secondary" type="button" onClick={onCheckPreservation} disabled={outOfDate} aria-describedby={outOfDate ? "stale-transformation-help" : undefined}>
          {isLoading ? "Checking dependency preservation…" : preservation.data ? <>Check again<span className="visually-hidden">: dependency preservation</span></> : "Check dependency preservation"}
        </button>
        <div className="transformation-live-status" role="status" aria-live="polite">{isLoading ? (preservation.data ? "Updating dependency preservation…" : "Checking dependency preservation…") : preservation.status === "success" ? "Dependency preservation check complete." : ""}</div>
        {preservationError ? <div className="transformation-error" role="alert"><strong>Unable to check dependency preservation.</strong><p>{preservationError}</p></div> : null}
      </div>
      {preservation.data ? <DependencyPreservationResult result={preservation.data} snapshot={snapshot} /> : null}
    </section>
  );
}
