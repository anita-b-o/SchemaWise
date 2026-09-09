import type { AnalysisResponseDto, SchemaInputDto } from "../../../api/schemawise-contracts";
import { formatAttributeSet, formatFunctionalDependency, formatRelation } from "../schema-formatters";
import { NormalFormSummary } from "./NormalFormSummary";
import { ViolationDetails } from "./ViolationDetails";

interface AnalysisResultsProps {
  readonly result: AnalysisResponseDto;
  readonly analyzedSnapshot: SchemaInputDto;
  readonly outOfDate: boolean;
}

export function AnalysisResults({ result, analyzedSnapshot, outOfDate }: AnalysisResultsProps) {
  const lookup = new Map(analyzedSnapshot.relation.attributes.map((attribute) => [attribute.id, attribute.name]));

  return (
    <article className="analysis-results" aria-labelledby="analysis-heading">
      <header className="analysis-header">
        <div>
          <p className="eyebrow">Analysis</p>
          <h2 id="analysis-heading"><code>{formatRelation(analyzedSnapshot)}</code></h2>
        </div>
        <span className={outOfDate ? "analysis-currency analysis-currency--stale" : "analysis-currency"}>{outOfDate ? "Out of date" : "Current"}</span>
      </header>

      {outOfDate ? (
        <div className="stale-notice" role="status">
          <strong>Results are out of date</strong>
          <p>The schema has changed since this analysis. Analyze again to update the results.</p>
        </div>
      ) : null}

      <section className="analysis-section key-facts" aria-label="Key facts">
        <div>
          <h3>Candidate keys</h3>
          <div className="notation-list">
            {result.candidateKeys.map((key, index) => <code key={`${key.join(":")}:${index}`}>{formatAttributeSet(key, lookup)}</code>)}
          </div>
        </div>
        <div>
          <h3>Prime attributes</h3>
          <code>{formatAttributeSet(result.primeAttributes, lookup)}</code>
          <p className="section-help">An attribute is prime if it belongs to at least one candidate key.</p>
        </div>
      </section>

      <NormalFormSummary normalForms={result.normalForms} />

      <section className="analysis-section" aria-labelledby="minimal-cover-heading">
        <h3 id="minimal-cover-heading">Minimal cover</h3>
        <p className="section-help">An equivalent minimal set of functional dependencies.</p>
        {result.minimalCover.length === 0 ? <code>∅</code> : (
          <div className="notation-list">
            {result.minimalCover.map((dependency, index) => <code key={`${dependency.left.join(":")}:${dependency.right.join(":")}:${index}`}>{formatFunctionalDependency(dependency, lookup)}</code>)}
          </div>
        )}
      </section>

      <ViolationDetails result={result} lookup={lookup} />
    </article>
  );
}
