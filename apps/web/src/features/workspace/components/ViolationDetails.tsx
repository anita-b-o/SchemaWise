import type { AnalysisResponseDto } from "../../../api/schemawise-contracts";
import { explainBcnf, explainSecondNormalForm, explainThirdNormalForm, type Explanation } from "../../explanations/explanation-builders";

interface ViolationDetailsProps {
  readonly result: AnalysisResponseDto;
  readonly lookup: ReadonlyMap<string, string>;
}

function ViolationGroup({ title, explanations }: { readonly title: string; readonly explanations: readonly Explanation[] }) {
  if (explanations.length === 0) return null;
  return (
    <details className="violation-group">
      <summary>{title} <span className="violation-count">{explanations.length} {explanations.length === 1 ? "violation" : "violations"}</span></summary>
      <ol className="violation-list">
        {explanations.map((explanation, index) => (
          <li key={`${explanation.dependency}:${index}`}>
            {explanation.label ? <strong className="violation-label">{explanation.label}</strong> : null}
            <code className="violation-dependency">{explanation.dependency}</code>
            <ul>
              {explanation.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function ViolationDetails({ result, lookup }: ViolationDetailsProps) {
  const { normalForms, primeAttributes } = result;
  const second = normalForms.second.violations.map((violation) => explainSecondNormalForm(violation, lookup));
  const third = normalForms.third.violations.map((violation) => explainThirdNormalForm(violation, primeAttributes, lookup));
  const bcnf = normalForms.bcnf.violations.map((violation) => explainBcnf(violation, lookup));
  if (second.length + third.length + bcnf.length === 0) return null;

  return (
    <section className="analysis-section violation-details" aria-labelledby="violation-details-heading">
      <h3 id="violation-details-heading">Violation details</h3>
      <p className="section-help">Open a normal form to inspect the evidence identified by the analysis.</p>
      <ViolationGroup title="2NF violations" explanations={second} />
      <ViolationGroup title="3NF violations" explanations={third} />
      <ViolationGroup title="BCNF violations" explanations={bcnf} />
    </section>
  );
}
