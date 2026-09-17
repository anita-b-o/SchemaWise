import { useRef, useState } from "react";
import type { AnalysisResponseDto, BcnfDecompositionResponseDto, DependencyPreservationResponseDto, SchemaInputDto, ThirdNormalFormSynthesisResponseDto } from "../../../api/schemawise-contracts";
import { formatRelation } from "../schema-formatters";
import { TRANSFORMATION_COPY } from "../transformation-explanations";
import type { TransformationState } from "../workspace-reducer";
import { BcnfResult } from "./BcnfResult";
import { CandidateKeysResult, MinimalCoverResult, PrimeAttributesResult } from "./EducationalAnalysis";
import { NormalFormSummary } from "./NormalFormSummary";
import { SynthesisResult } from "./SynthesisResult";
import { ConceptGlossary } from "./ConceptHelp";
import { SchemaVisualization, type VisualizationMode } from "./SchemaVisualization";

interface AnalysisResultsProps {
  readonly result: AnalysisResponseDto;
  readonly draftSnapshot?: SchemaInputDto | undefined;
  readonly analyzedSnapshot: SchemaInputDto;
  readonly outOfDate: boolean;
  readonly synthesis: TransformationState<ThirdNormalFormSynthesisResponseDto>;
  readonly bcnf: TransformationState<BcnfDecompositionResponseDto>;
  readonly preservation: TransformationState<DependencyPreservationResponseDto>;
  readonly synthesisError?: string | undefined;
  readonly bcnfError?: string | undefined;
  readonly preservationError?: string | undefined;
  readonly onGenerateSynthesis: () => void;
  readonly onGenerateBcnf: () => void;
  readonly onCheckPreservation: () => void;
}

export function AnalysisResults({ result, draftSnapshot, analyzedSnapshot, outOfDate, synthesis, bcnf, preservation, synthesisError, bcnfError, preservationError, onGenerateSynthesis, onGenerateBcnf, onCheckPreservation }: AnalysisResultsProps) {
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

  function showTransformationsDiagram(target: "3NF synthesis diagram" | "BCNF decomposition diagram") {
    setVisualizationMode("transformations");
    setVisualizationOpen(true);
    setTimeout(() => resultsRef.current?.querySelector<HTMLElement>(`[aria-label="${target}"]`)?.focus());
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
        synthesis={synthesis}
        bcnf={bcnf}
        preservation={preservation}
        open={visualizationOpen}
        mode={visualizationMode}
        selectedViolationId={selectedViolationId}
        onToggle={() => setVisualizationOpen((current) => !current)}
        onModeChange={setVisualizationMode}
        onSelectViolation={selectViolation}
      />

      {!result.normalForms.third.satisfied || !result.normalForms.bcnf.satisfied ? (
        <section className="analysis-section transformations" aria-labelledby="transformations-heading">
          <h3 id="transformations-heading">Transformations</h3>
          {outOfDate ? <p className="stale-transformation-help" id="stale-transformation-help">{TRANSFORMATION_COPY.stale}</p> : null}

          {!result.normalForms.third.satisfied ? (
            <div className="transformation-flow" aria-busy={synthesis.status === "loading"}>
              <div className="transformation-action-row">
                <div><h4>3NF synthesis</h4><p>Create a dependency-preserving, lossless decomposition.</p></div>
                <button className={`button ${synthesis.data ? "button--quiet" : "button--primary"}`} type="button" onClick={onGenerateSynthesis} disabled={outOfDate} aria-describedby={outOfDate ? "stale-transformation-help" : undefined}>
                  {synthesis.status === "loading" ? "Generating 3NF synthesis…" : synthesis.data ? <>Run again<span className="visually-hidden">: 3NF synthesis</span></> : "Generate 3NF synthesis"}
                </button>
              </div>
              <div className="transformation-live-status" role="status" aria-live="polite">{synthesis.status === "loading" ? (synthesis.data ? "Updating synthesis…" : "Generating 3NF synthesis…") : synthesis.status === "success" ? "3NF synthesis complete." : ""}</div>
              {synthesisError ? <div className="transformation-error" role="alert"><strong>Unable to generate 3NF synthesis.</strong><p>{synthesisError}</p></div> : null}
              {synthesis.data ? <SynthesisResult result={synthesis.data} snapshot={analyzedSnapshot} onViewDiagram={() => showTransformationsDiagram("3NF synthesis diagram")} /> : null}
            </div>
          ) : null}

          {!result.normalForms.bcnf.satisfied ? (
            <div className="transformation-flow" aria-busy={bcnf.status === "loading"}>
              <div className="transformation-action-row">
                <div><h4>BCNF decomposition</h4><p>Decompose the relation into BCNF relations.</p></div>
                <button className={`button ${bcnf.data ? "button--quiet" : "button--primary"}`} type="button" onClick={onGenerateBcnf} disabled={outOfDate} aria-describedby={outOfDate ? "stale-transformation-help" : undefined}>
                  {bcnf.status === "loading" ? "Generating BCNF decomposition…" : bcnf.data ? <>Run again<span className="visually-hidden">: BCNF decomposition</span></> : "Generate BCNF decomposition"}
                </button>
              </div>
              <div className="transformation-live-status" role="status" aria-live="polite">{bcnf.status === "loading" ? (bcnf.data ? "Updating decomposition…" : "Generating BCNF decomposition…") : bcnf.status === "success" ? "BCNF decomposition complete." : ""}</div>
              {bcnfError ? <div className="transformation-error" role="alert"><strong>Unable to generate BCNF decomposition.</strong><p>{bcnfError}</p></div> : null}
              {bcnf.data ? <BcnfResult result={bcnf.data} snapshot={analyzedSnapshot} outOfDate={outOfDate} preservation={preservation} preservationError={preservationError} onCheckPreservation={onCheckPreservation} onViewDiagram={() => showTransformationsDiagram("BCNF decomposition diagram")} /> : null}
            </div>
          ) : null}
        </section>
      ) : null}
      <ConceptGlossary />
    </article>
  );
}
