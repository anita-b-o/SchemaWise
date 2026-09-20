import { useState } from "react";
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

interface IssueExplanation {
  readonly groupKey: string;
  readonly normalForm: NormalFormKind;
  readonly selectionId: string;
  readonly explanation: Explanation;
}

interface Issue {
  readonly dependency: string;
  readonly explanations: readonly IssueExplanation[];
}

const INITIAL_ISSUE_COUNT = 8;

function issuesFor(result: AnalysisResponseDto, lookup: ReadonlyMap<string, string>, snapshot: SchemaInputDto): readonly Issue[] {
  const entries: IssueExplanation[] = [
    ...result.normalForms.second.violations.map((violation, index) => ({ groupKey: JSON.stringify([violation.determinant, violation.dependent]), normalForm: "2NF" as const, selectionId: violationSelectionId("2NF", index), explanation: explainSecondNormalForm(violation, lookup, snapshot) })),
    ...result.normalForms.third.violations.map((violation, index) => ({ groupKey: JSON.stringify([violation.determinant, violation.dependent]), normalForm: "3NF" as const, selectionId: violationSelectionId("3NF", index), explanation: explainThirdNormalForm(violation, result.primeAttributes, lookup, snapshot) })),
    ...result.normalForms.bcnf.violations.map((violation, index) => ({ groupKey: JSON.stringify([violation.determinant, violation.dependent]), normalForm: "BCNF" as const, selectionId: violationSelectionId("BCNF", index), explanation: explainBcnf(violation, lookup, snapshot) })),
  ];
  const grouped = new Map<string, IssueExplanation[]>();
  for (const entry of entries) grouped.set(entry.groupKey, [...(grouped.get(entry.groupKey) ?? []), entry]);
  return [...grouped.values()].map((explanations) => ({ dependency: explanations[0]!.explanation.dependency, explanations }));
}

export function ViolationDetails({ result, lookup, snapshot, selectedViolationId, onSelectViolation }: ViolationDetailsProps) {
  const [expanded, setExpanded] = useState(false);
  const issues = issuesFor(result, lookup, snapshot);
  if (issues.length === 0) return null;
  const largeSet = issues.length > INITIAL_ISSUE_COUNT;
  const visibleIssues = largeSet && !expanded ? issues.slice(0, INITIAL_ISSUE_COUNT) : issues;

  return (
    <div className="normal-form-issues">
      <div className="issues-heading-row">
        <h4>Issues</h4>
        <span>{issues.length} {issues.length === 1 ? "dependency" : "dependencies"}</span>
      </div>
      {largeSet ? <p className="issues-context">This analysis includes dependencies implied by the entered functional dependencies, so it can report more violations than the number entered.</p> : null}
      <ol className="issue-list" role="list" id="normal-form-issue-list">
        {visibleIssues.map((issue) => {
          const selected = issue.explanations.some(({ selectionId }) => selectionId === selectedViolationId);
          const forms = issue.explanations.map(({ normalForm }) => normalForm);
          return (
            <li key={issue.dependency} className={selected ? "issue-list__item--selected" : undefined}>
              <div className="issue-summary">
                <code className="violation-dependency">{issue.dependency}</code>
                <span>Violates {forms.join(" and ")}</span>
              </div>
              <div className="issue-actions">
                <details className="educational-disclosure issue-explanation">
                  <summary>Explain issue <span className="visually-hidden">{issue.dependency}</span></summary>
                  <div className="educational-disclosure__content">
                    {issue.explanations.map(({ normalForm, selectionId, explanation }) => (
                      <section className="issue-reason" aria-labelledby={`${selectionId}-reason`} key={selectionId}>
                        <h5 id={`${selectionId}-reason`}>{normalForm}</h5>
                        {explanation.label ? <strong className="violation-label">{explanation.label}</strong> : null}
                        <ul className="violation-evidence">{explanation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                        <EducationalExplanationView explanation={explanation.educational} lookup={lookup} includeFormal={false} />
                        {explanation.educational.formal ? (
                          <details className="formal-reasoning-disclosure">
                            <summary>Formal reasoning <span className="visually-hidden">for {normalForm} issue {issue.dependency}</span></summary>
                            <FormalReasoning content={explanation.educational.formal} lookup={lookup} />
                          </details>
                        ) : null}
                      </section>
                    ))}
                  </div>
                </details>
                {onSelectViolation ? (
                  <button className="button button--quiet violation-diagram-action" type="button" aria-pressed={selected} onClick={() => onSelectViolation(issue.explanations[0]!.selectionId)}>
                    {selected ? "Selected in diagram" : "Show in diagram"}<span className="visually-hidden">: {issue.dependency}</span>
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {largeSet ? (
        <button className="button button--quiet issues-toggle" type="button" aria-expanded={expanded} aria-controls="normal-form-issue-list" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Show fewer issues" : `Show all ${issues.length} issues`}
        </button>
      ) : null}
    </div>
  );
}
