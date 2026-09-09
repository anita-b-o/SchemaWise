import type { NormalFormDiagnosticsDto } from "../../../api/schemawise-contracts";
import { ONE_NF_NOTICE } from "../../explanations/explanation-builders";

interface NormalFormSummaryProps {
  readonly normalForms: NormalFormDiagnosticsDto;
}

export function NormalFormSummary({ normalForms }: NormalFormSummaryProps) {
  const rows = [
    ["2NF", normalForms.second],
    ["3NF", normalForms.third],
    ["BCNF", normalForms.bcnf],
  ] as const;

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
            <span className="normal-form-count">{form.violations.length > 0 ? `${form.violations.length} ${form.violations.length === 1 ? "violation" : "violations"}` : ""}</span>
          </div>
        ))}
      </div>
      <p className="one-nf-notice">{ONE_NF_NOTICE}</p>
    </section>
  );
}
