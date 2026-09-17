import type { AnalysisResponseDto, SchemaInputDto } from "../../../api/schemawise-contracts";
import { BCNF_SATISFIED, ONE_NF_NOTICE, SECOND_NF_SATISFIED, SECOND_TO_THIRD_CONTEXT, THIRD_NF_SATISFIED, THIRD_TO_BCNF_CONTEXT } from "../../explanations/explanation-builders";
import { ConceptDefinitionContent } from "./ConceptHelp";
import { ViolationDetails } from "./ViolationDetails";

interface NormalFormSummaryProps {
  readonly result: AnalysisResponseDto;
  readonly snapshot: SchemaInputDto;
  readonly lookup: ReadonlyMap<string, string>;
  readonly selectedViolationId?: string | undefined;
  readonly onSelectViolation?: ((id: string) => void) | undefined;
}

export function NormalFormSummary({ result, snapshot, lookup, selectedViolationId, onSelectViolation }: NormalFormSummaryProps) {
  const { normalForms } = result;
  const rows = [
    ["2NF", normalForms.second],
    ["3NF", normalForms.third],
    ["BCNF", normalForms.bcnf],
  ] as const;
  const satisfiedCopy = { "2NF": SECOND_NF_SATISFIED, "3NF": THIRD_NF_SATISFIED, BCNF: BCNF_SATISFIED } as const;

  return (
    <section className="analysis-section" aria-labelledby="normal-forms-heading">
      <h3 id="normal-forms-heading">Normal forms</h3>
      <div className="normal-form-summary">
        {rows.map(([name, form]) => (
          <div className="normal-form-row" key={name}>
            <span className="normal-form-name">{name}</span>
            <span className={form.satisfied ? "normal-form-status normal-form-status--satisfied" : "normal-form-status normal-form-status--violated"}>
              <span aria-hidden="true">{form.satisfied ? "✓" : "×"}</span>
              {form.satisfied ? "Satisfied" : "Violated"}
            </span>
            <span className="normal-form-count">{form.violations.length > 0 ? `${form.violations.length} ${form.violations.length === 1 ? "violation" : "violations"}` : form.satisfied ? "No violations" : ""}</span>
          </div>
        ))}
      </div>
      <ViolationDetails result={result} lookup={lookup} snapshot={snapshot} selectedViolationId={selectedViolationId} onSelectViolation={onSelectViolation} />
      <details className="educational-disclosure normal-form-explanation">
        <summary>Explain normal forms</summary>
        <div className="educational-disclosure__content">
          <p className="explanation-label"><strong>Why these results</strong></p>
          {rows.map(([name, form]) => form.satisfied ? <p key={name}><strong>{name}.</strong> {satisfiedCopy[name]}</p> : null)}
          {normalForms.second.satisfied && !normalForms.third.satisfied ? <p>{SECOND_TO_THIRD_CONTEXT}</p> : null}
          {normalForms.third.satisfied && !normalForms.bcnf.satisfied ? <p>{THIRD_TO_BCNF_CONTEXT}</p> : null}
          <p className="normal-form-implication"><span aria-hidden="true">BCNF ⇒ 3NF ⇒ 2NF</span><span className="visually-hidden">BCNF implies 3NF implies 2NF</span></p>
          <p className="one-nf-notice">{ONE_NF_NOTICE}</p>
          <div className="related-concept"><span>Related concept</span><ConceptDefinitionContent concept="bcnf" /></div>
        </div>
      </details>
    </section>
  );
}
