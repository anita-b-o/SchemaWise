import type { AnalysisResponseDto, SchemaInputDto } from "../../../api/schemawise-contracts";
import { explainBcnf, explainSecondNormalForm, explainThirdNormalForm, type Explanation } from "../../explanations/explanation-builders";
import { EducationalExplanationView, FormalReasoning } from "./EducationalAnalysis";
import { type NormalFormKind, violationSelectionId } from "../schema-visualization-model";

interface ViolationDetailsProps {
  readonly result: AnalysisResponseDto;
  readonly lookup: ReadonlyMap<string, string>;
  readonly snapshot: SchemaInputDto;
  readonly selectedViolationId?: string | undefined;
  readonly onSelectViolation?: ((id: string) => void) | undefined;
}

function ViolationGroup({ title, normalForm, explanations, lookup, selectedViolationId, onSelectViolation }: { readonly title: string; readonly normalForm: NormalFormKind; readonly explanations: readonly Explanation[]; readonly lookup: ReadonlyMap<string, string>; readonly selectedViolationId?: string | undefined; readonly onSelectViolation?: ((id: string) => void) | undefined }) {
  if (explanations.length === 0) return null;
  return (
    <details className="violation-group">
      <summary>{title} <span className="violation-count">{explanations.length} {explanations.length === 1 ? "violation" : "violations"}</span></summary>
      <ol className="violation-list">
        {explanations.map((explanation, index) => {
          const selectionId = violationSelectionId(normalForm, index);
          const selected = selectionId === selectedViolationId;
          return (
            <li key={`${explanation.dependency}:${index}`} className={selected ? "violation-list__item--selected" : undefined}>
              {explanation.label ? <strong className="violation-label">{explanation.label}</strong> : null}
              <code className="violation-dependency">{explanation.dependency}</code>
              <ul className="violation-evidence">
                {explanation.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              <details className="formal-reasoning-disclosure">
                <summary>Why? <span className="visually-hidden">for {explanation.dependency}</span></summary>
                <EducationalExplanationView explanation={explanation.educational} lookup={lookup} includeFormal={false} />
              </details>
              {explanation.educational.formal ? <details className="formal-reasoning-disclosure">
                <summary>Formal reasoning <span className="visually-hidden">for {explanation.dependency}</span></summary>
                <FormalReasoning content={explanation.educational.formal} lookup={lookup} />
              </details> : null}
              {onSelectViolation ? <button className="button button--quiet violation-diagram-action" type="button" aria-pressed={selected} onClick={() => onSelectViolation(selectionId)}>{selected ? "Selected in diagram" : "Show in diagram"}<span className="visually-hidden">: {explanation.dependency}</span></button> : null}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

export function ViolationDetails({ result, lookup, snapshot, selectedViolationId, onSelectViolation }: ViolationDetailsProps) {
  const { normalForms, primeAttributes } = result;
  const second = normalForms.second.violations.map((violation) => explainSecondNormalForm(violation, lookup, snapshot));
  const third = normalForms.third.violations.map((violation) => explainThirdNormalForm(violation, primeAttributes, lookup, snapshot));
  const bcnf = normalForms.bcnf.violations.map((violation) => explainBcnf(violation, lookup, snapshot));
  if (second.length + third.length + bcnf.length === 0) return null;

  return (
    <section className="analysis-section violation-details" aria-labelledby="violation-details-heading">
      <h3 id="violation-details-heading">Violation details</h3>
      <p className="section-help">Open a normal form to inspect the evidence identified by the analysis.</p>
      <ViolationGroup title="2NF violations" normalForm="2NF" explanations={second} lookup={lookup} selectedViolationId={selectedViolationId} onSelectViolation={onSelectViolation} />
      <ViolationGroup title="3NF violations" normalForm="3NF" explanations={third} lookup={lookup} selectedViolationId={selectedViolationId} onSelectViolation={onSelectViolation} />
      <ViolationGroup title="BCNF violations" normalForm="BCNF" explanations={bcnf} lookup={lookup} selectedViolationId={selectedViolationId} onSelectViolation={onSelectViolation} />
    </section>
  );
}
