import { useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DelayedAsyncHint } from "../../../components/DelayedAsyncHint";
import type { AnalysisResponseDto, BcnfDecompositionResponseDto, DependencyPreservationResponseDto, SchemaInputDto, ThirdNormalFormSynthesisResponseDto } from "../../../api/schemawise-contracts";
import { formatRelation } from "../schema-formatters";
import { TRANSFORMATION_COPY } from "../transformation-explanations";
import type { TransformationState } from "../workspace-reducer";
import { BcnfResult } from "./BcnfResult";
import { DependencyPreservationResult } from "./DependencyPreservationResult";
import { SynthesisResult } from "./SynthesisResult";
import { TransformationsMode } from "./SchemaVisualization";

interface TransformSurfaceProps {
  readonly analysis?: AnalysisResponseDto | undefined;
  readonly snapshot?: SchemaInputDto | undefined;
  readonly outOfDate: boolean;
  readonly synthesis: TransformationState<ThirdNormalFormSynthesisResponseDto>;
  readonly bcnf: TransformationState<BcnfDecompositionResponseDto>;
  readonly preservation: TransformationState<DependencyPreservationResponseDto>;
  readonly synthesisError?: string | undefined;
  readonly bcnfError?: string | undefined;
  readonly preservationError?: string | undefined;
  readonly analysisHref: string;
  readonly schemaHref: string;
  readonly onNavigate: () => void;
  readonly onGenerateSynthesis: () => void;
  readonly onGenerateBcnf: () => void;
  readonly onCheckPreservation: () => void;
  readonly headingRef: React.Ref<HTMLHeadingElement>;
}

export function TransformSurface({ analysis, snapshot, outOfDate, synthesis, bcnf, preservation, synthesisError, bcnfError, preservationError, analysisHref, schemaHref, onNavigate, onGenerateSynthesis, onGenerateBcnf, onCheckPreservation, headingRef }: TransformSurfaceProps) {
  const [diagramOpen, setDiagramOpen] = useState(false);
  const diagramId = useId();
  const diagramsRef = useRef<HTMLDivElement>(null);
  const hasResults = Boolean(synthesis.data || bcnf.data || preservation.data);
  const canSynthesize = Boolean(analysis && !analysis.normalForms.third.satisfied);
  const canDecompose = Boolean(analysis && !analysis.normalForms.bcnf.satisfied);

  function showDiagram(label: string) {
    setDiagramOpen(true);
    setTimeout(() => diagramsRef.current?.querySelector<HTMLElement>(`[aria-label="${label}"]`)?.focus());
  }

  return <section className="transform-surface">
    <header className="surface-heading transform-heading">
      <div><p className="eyebrow">Transform</p><h1 ref={headingRef} tabIndex={-1}>Transformations</h1>
        {snapshot ? <p className="transform-snapshot"><code>{formatRelation(snapshot)}</code> <span className={outOfDate ? "analysis-currency analysis-currency--stale" : "analysis-currency"}>{outOfDate ? "Out of date" : "Current"}</span></p> : null}
        {analysis ? <p>{analysis.normalForms.bcnf.satisfied ? "This analyzed relation already satisfies BCNF. No decomposition is needed." : "Compare a dependency-preserving 3NF synthesis with a BCNF decomposition of this analyzed snapshot."}</p> : <p>Analyze the schema before exploring transformations.</p>}
      </div>
      <div className="transform-heading__actions">
        {analysis ? <Link className="button button--secondary" to={analysisHref} onClick={onNavigate}>Back to analysis</Link> : null}
        {!outOfDate || !analysis ? <Link className={analysis ? "button button--quiet" : "button button--primary"} to={schemaHref} onClick={onNavigate}>{analysis ? "Edit schema" : "Go to Schema"}</Link> : null}
      </div>
    </header>

    {analysis && snapshot ? <>
      {outOfDate ? <div className="stale-notice" role="status" id="stale-transformation-help"><strong>Out of date</strong><p>These results belong to the previous analyzed snapshot. {TRANSFORMATION_COPY.stale}</p><div className="button-row"><Link className="button button--secondary" to={analysisHref} onClick={onNavigate}>View analysis</Link><Link className="button button--quiet" to={schemaHref} onClick={onNavigate}>Edit schema</Link></div></div> : null}

      <div className="transform-sequence">
        <section className="transform-stage" aria-labelledby="synthesis-stage-heading" aria-busy={synthesis.status === "loading"}>
          <div className="transformation-action-row"><div><p className="eyebrow">01 / Preserve dependencies</p><h2 id="synthesis-stage-heading">3NF Synthesis</h2><p>{canSynthesize ? "Generate a dependency-preserving, lossless 3NF decomposition." : "This analyzed relation already satisfies 3NF; synthesis is unnecessary."}</p></div>
            {canSynthesize && (!outOfDate || synthesis.data) ? <button className={`button ${synthesis.data ? "button--quiet" : "button--primary"}`} type="button" onClick={onGenerateSynthesis} disabled={outOfDate} aria-describedby={outOfDate ? "stale-transformation-help" : undefined}>{synthesis.status === "loading" ? "Generating 3NF synthesis…" : synthesis.data ? <>Run again<span className="visually-hidden">: 3NF synthesis</span></> : "Generate 3NF synthesis"}</button> : null}
          </div>
          <div className="transformation-live-status" role="status" aria-live="polite">{synthesis.status === "loading" ? (synthesis.data ? "Updating synthesis…" : "Generating 3NF synthesis…") : synthesis.status === "success" ? "3NF synthesis complete." : ""}</div>
          <DelayedAsyncHint active={synthesis.status === "loading"} requestKey={synthesis.requestId} />
          {synthesisError ? <div className="transformation-error" role="alert"><strong>Unable to generate 3NF synthesis.</strong><p>{synthesisError}</p></div> : null}
          {synthesis.data ? <SynthesisResult result={synthesis.data} snapshot={snapshot} onViewDiagram={() => showDiagram("3NF synthesis diagram")} /> : null}
        </section>

        <section className="transform-stage" aria-labelledby="bcnf-stage-heading" aria-busy={bcnf.status === "loading"}>
          <div className="transformation-action-row"><div><p className="eyebrow">02 / Stronger normal form</p><h2 id="bcnf-stage-heading">BCNF Decomposition</h2><p>{canDecompose ? "BCNF is stricter than 3NF. Its lossless decomposition may not preserve every dependency." : "This analyzed relation already satisfies BCNF; no decomposition is needed."}</p></div>
            {canDecompose && (!outOfDate || bcnf.data) ? <button className={`button ${bcnf.data ? "button--quiet" : "button--primary"}`} type="button" onClick={onGenerateBcnf} disabled={outOfDate} aria-describedby={outOfDate ? "stale-transformation-help" : undefined}>{bcnf.status === "loading" ? "Generating BCNF decomposition…" : bcnf.data ? <>Run again<span className="visually-hidden">: BCNF decomposition</span></> : "Generate BCNF decomposition"}</button> : null}
          </div>
          <div className="transformation-live-status" role="status" aria-live="polite">{bcnf.status === "loading" ? (bcnf.data ? "Updating decomposition…" : "Generating BCNF decomposition…") : bcnf.status === "success" ? "BCNF decomposition complete." : ""}</div>
          <DelayedAsyncHint active={bcnf.status === "loading"} requestKey={bcnf.requestId} />
          {bcnfError ? <div className="transformation-error" role="alert"><strong>Unable to generate BCNF decomposition.</strong><p>{bcnfError}</p></div> : null}
          {bcnf.data ? <BcnfResult result={bcnf.data} snapshot={snapshot} onViewDiagram={() => showDiagram("BCNF decomposition diagram")} /> : null}
        </section>

        <section className="transform-stage" aria-labelledby="preservation-stage-heading" aria-busy={preservation.status === "loading"}>
          <div className="transformation-action-row"><div><p className="eyebrow">03 / Check the trade-off</p><h2 id="preservation-stage-heading">Dependency Preservation</h2><p>{bcnf.data ? "Check whether the BCNF relations preserve the original functional dependencies. Lossless join is a separate property." : analysis.normalForms.bcnf.satisfied ? "The relation already satisfies BCNF, so there is no decomposition to check." : "Generate a BCNF decomposition to make this check available."}</p></div>
            {bcnf.data && (!outOfDate || preservation.data) ? <button className={`button ${preservation.data ? "button--quiet" : "button--secondary"}`} type="button" onClick={onCheckPreservation} disabled={outOfDate} aria-describedby={outOfDate ? "stale-transformation-help" : undefined}>{preservation.status === "loading" ? "Checking dependency preservation…" : preservation.data ? <>Check again<span className="visually-hidden">: dependency preservation</span></> : "Check dependency preservation"}</button> : null}
          </div>
          <div className="transformation-live-status" role="status" aria-live="polite">{preservation.status === "loading" ? (preservation.data ? "Updating dependency preservation…" : "Checking dependency preservation…") : preservation.status === "success" ? "Dependency preservation check complete." : ""}</div>
          <DelayedAsyncHint active={preservation.status === "loading"} requestKey={preservation.requestId} />
          {preservationError ? <div className="transformation-error" role="alert"><strong>Unable to check dependency preservation.</strong><p>{preservationError}</p></div> : null}
          {preservation.data ? <DependencyPreservationResult result={preservation.data} snapshot={snapshot} /> : null}
        </section>
      </div>

      {synthesis.data && bcnf.data ? <section className="transform-comparison" aria-labelledby="transform-comparison-heading"><h2 id="transform-comparison-heading">Compare the results</h2><div className="transform-comparison__grid"><div><h3>3NF</h3><p>{synthesis.data.relations.length} relations · Dependency preserving · Lossless join</p></div><div><h3>BCNF</h3><p>{bcnf.data.relations.length} relations · Lossless join · Preservation: {preservation.data ? preservation.data.preserved ? "Preserved" : "Not preserved" : "Not checked"}</p></div></div></section> : null}

      {hasResults ? <section className="schema-visualization transform-visualization" aria-label="Transformation diagrams"><button className="schema-visualization__toggle" type="button" aria-expanded={diagramOpen} aria-controls={diagramId} onClick={() => setDiagramOpen((current) => !current)}><span><span className="eyebrow">View</span><strong>Transformation diagrams</strong></span><span aria-hidden="true">{diagramOpen ? "−" : "+"}</span></button>{diagramOpen ? <div id={diagramId} className="schema-visualization__content" ref={diagramsRef}><TransformationsMode snapshot={snapshot} synthesis={synthesis} bcnf={bcnf} preservation={preservation} />{outOfDate ? <p className="diagram-stale-note">Out of date: these diagrams remain tied to {formatRelation(snapshot)}.</p> : null}</div> : null}</section> : null}
    </> : null}
  </section>;
}
