import { useRef, useState } from "react";
import type { AnalysisResponseDto, SchemaInputDto } from "../../../api/schemawise-contracts";
import { formatRelation } from "../schema-formatters";
import { CandidateKeysResult, MinimalCoverResult, PrimeAttributesResult } from "./EducationalAnalysis";
import { NormalFormSummary } from "./NormalFormSummary";
import { ConceptGlossary } from "./ConceptHelp";
import { SchemaVisualization, type VisualizationMode } from "./SchemaVisualization";

interface AnalysisResultsProps {
  readonly result: AnalysisResponseDto;
  readonly draftSnapshot?: SchemaInputDto | undefined;
  readonly analyzedSnapshot: SchemaInputDto;
  readonly outOfDate: boolean;
}

export function AnalysisResults({ result, draftSnapshot, analyzedSnapshot, outOfDate }: AnalysisResultsProps) {
  const lookup = new Map(analyzedSnapshot.relation.attributes.map((attribute) => [attribute.id, attribute.name]));
  const [visualizationOpen, setVisualizationOpen] = useState(false);
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>("schema");
  const [selectedViolationId, setSelectedViolationId] = useState<string>();
  const resultsRef = useRef<HTMLElement>(null);

  function focusVisualization() {
    setTimeout(() => resultsRef.current?.querySelector<HTMLElement>(".schema-visualization__content")?.focus());
  }

  function selectViolation(id: string) {
    setSelectedViolationId(id);
    setVisualizationMode("analysis");
    setVisualizationOpen(true);
    focusVisualization();
  }


  return (
    <article ref={resultsRef} className="analysis-results" aria-labelledby="analysis-heading">
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

      <section className="analysis-summary" aria-label="Analysis summary">
        <section className="analysis-section key-facts" aria-label="Key facts">
          <CandidateKeysResult result={result} snapshot={analyzedSnapshot} lookup={lookup} />
          <PrimeAttributesResult result={result} snapshot={analyzedSnapshot} lookup={lookup} />
        </section>
        <NormalFormSummary result={result} snapshot={analyzedSnapshot} lookup={lookup} selectedViolationId={selectedViolationId} onSelectViolation={selectViolation} />
        <MinimalCoverResult result={result} snapshot={analyzedSnapshot} lookup={lookup} />
      </section>

      <SchemaVisualization
        result={result}
        draftSnapshot={draftSnapshot ?? analyzedSnapshot}
        analyzedSnapshot={analyzedSnapshot}
        outOfDate={outOfDate}
        open={visualizationOpen}
        mode={visualizationMode}
        selectedViolationId={selectedViolationId}
        onToggle={() => setVisualizationOpen((current) => !current)}
        onModeChange={setVisualizationMode}
        onSelectViolation={selectViolation}
      />

      <ConceptGlossary />
    </article>
  );
}
