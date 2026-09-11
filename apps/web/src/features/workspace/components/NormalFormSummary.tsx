import type { NormalFormDiagnosticsDto } from "../../../api/schemawise-contracts";
import { BCNF_SATISFIED, ONE_NF_NOTICE, SECOND_NF_SATISFIED, SECOND_TO_THIRD_CONTEXT, THIRD_NF_SATISFIED, THIRD_TO_BCNF_CONTEXT } from "../../explanations/explanation-builders";
import { ConceptHelp } from "./ConceptHelp";

interface NormalFormSummaryProps {
  readonly normalForms: NormalFormDiagnosticsDto;
}

export function NormalFormSummary({ normalForms }: NormalFormSummaryProps) {
  const rows = [
    ["2NF", normalForms.second],
    ["3NF", normalForms.third],
    ["BCNF", normalForms.bcnf],
  ] as const;
  const satisfiedCopy = { "2NF": SECOND_NF_SATISFIED, "3NF": THIRD_NF_SATISFIED, BCNF: BCNF_SATISFIED } as const;

  return (
    <section className="analysis-section" aria-labelledby="normal-forms-heading">
      <h3 id="normal-forms-heading">Normal forms</h3>
      <ConceptHelp concept="bcnf" label="About the hierarchy" />
      <div className="normal-form-summary">
        <div className="normal-form-row normal-form-row--assumed">
          <span className="normal-form-name">1NF*</span>
          <span className="normal-form-status">Assumed, not calculated</span>
        </div>
        {rows.map(([name, form]) => (
          <div className="normal-form-row" key={name}>
            <span className="normal-form-name">{name}</span>
            <span className={form.satisfied ? "normal-form-status normal-form-status--satisfied" : "normal-form-status normal-form-status--violated"}>
              <span aria-hidden="true">{form.satisfied ? "✓" : "×"}</span>
              {form.satisfied ? "Satisfied" : "Violated"}
            </span>
            <span className="normal-form-count">{form.violations.length > 0 ? `${form.violations.length} ${form.violations.length === 1 ? "violation" : "violations"}` : form.satisfied ? "No violations" : ""}</span>
            {form.satisfied ? <p className="normal-form-satisfied-copy">{satisfiedCopy[name]}</p> : null}
          </div>
        ))}
      </div>
      {normalForms.second.satisfied && !normalForms.third.satisfied ? <p className="normal-form-context">{SECOND_TO_THIRD_CONTEXT}</p> : null}
      {normalForms.third.satisfied && !normalForms.bcnf.satisfied ? <p className="normal-form-context">{THIRD_TO_BCNF_CONTEXT}</p> : null}
      <p className="normal-form-implication"><span aria-hidden="true">BCNF ⇒ 3NF ⇒ 2NF</span><span className="visually-hidden">BCNF implies 3NF implies 2NF</span></p>
      <p className="one-nf-notice">{ONE_NF_NOTICE}</p>
    </section>
  );
}
