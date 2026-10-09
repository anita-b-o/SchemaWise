import type { RefObject } from "react";
import { Link, useLocation } from "react-router-dom";
import { DelayedAsyncHint } from "../../../components/DelayedAsyncHint";
import { SchemaWiseApiError } from "../../../api/schemawise-api";
import type { ErrorCode } from "../../../api/schemawise-contracts";
import type { SharedWorkspaceCore } from "../shared-workspace-core";
import { setWorkspaceView, type WorkspaceView } from "../workspace-view";
import { AnalysisResults } from "./AnalysisResults";
import { AttributeList } from "./AttributeList";
import { ClosureTool } from "./ClosureTool";
import { FunctionalDependencyEditor } from "./FunctionalDependencyEditor";
import { RelationEditor } from "./RelationEditor";
import { TransformSurface } from "./TransformSurface";

const API_ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  ANALYSIS_LIMIT_EXCEEDED: "This schema is too large to analyze within the current limits. Reduce its size and try again.",
  UNKNOWN_ATTRIBUTE_REFERENCE: "A dependency refers to an attribute that is not part of this relation. Review the schema and try again.",
  ATTRIBUTE_IDENTITY_COLLISION: "Two attributes have conflicting technical identities. Recreate the affected attribute and try again.",
  INVALID_REQUEST: "The API could not validate this schema. Review the relation and dependencies, then try again.",
  INTERNAL_ERROR: "SchemaWise encountered an internal error while analyzing this schema. Try again.",
};
function analysisErrorMessage(error: unknown): { message: string; code?: string } {
  if (error instanceof SchemaWiseApiError) {
    if (error.kind === "network") return { message: "We couldn't reach SchemaWise. Check your connection and try again." };
    if (error.kind === "api") return { message: (error.code && API_ERROR_MESSAGES[error.code]) || "The API could not analyze this schema. Review the input and try again.", ...(error.code ? { code: error.code } : {}) };
  }
  return { message: "We couldn't analyze this schema. Try again." };
}
function transformationErrorMessage(error: unknown): string {
  if (error instanceof SchemaWiseApiError) {
    if (error.kind === "network") return "We couldn't reach SchemaWise. Check your connection and try again.";
    if (error.kind === "api") return "The API could not complete this operation for the analyzed schema. Review the analysis and try again.";
  }
  return "SchemaWise couldn't complete this operation. Try again.";
}

export function WorkspaceSurfaces({ core, activeView, navigationBlocked, confirmExample, onRequestExample, onCancelExample, onLoadExample, surfaceHeadingRef, onNavigate, emptyAnalysisMessage }: {
  readonly core: SharedWorkspaceCore;
  readonly activeView: WorkspaceView;
  readonly navigationBlocked: boolean;
  readonly confirmExample: boolean;
  readonly onRequestExample?: () => void;
  readonly onCancelExample?: () => void;
  readonly onLoadExample?: () => void;
  readonly surfaceHeadingRef: RefObject<HTMLHeadingElement | null>;
  readonly onNavigate: () => void;
  readonly emptyAnalysisMessage: string;
}) {
  const location = useLocation();
  const { state, issues, dispatch } = core;
  const isAnalyzing = state.analysis.status === "loading";
  const hasResult = state.analysis.data !== undefined && state.analysis.inputSnapshot !== undefined;
  const referenceCounts = new Map(state.draft.attributes.map((attribute) => [attribute.id, state.draft.functionalDependencies.filter((dependency) => dependency.left.includes(attribute.id) || dependency.right.includes(attribute.id)).length]));
  const presentedError = state.analysis.status === "error" ? analysisErrorMessage(state.analysis.error) : undefined;
  const firstIssue = issues[0];
  const analyzeHelp = firstIssue ? (issues.filter((issue) => issue.message === firstIssue.message).length > 1 ? "Resolve the highlighted schema errors before analyzing." : firstIssue.message) : undefined;
  const href = (view: WorkspaceView) => { const params = setWorkspaceView(new URLSearchParams(location.search), view); return `${location.pathname}${params.toString() ? `?${params}` : ""}`; };
  return <>
    {activeView === "schema" ? <>
      <div className="page-introduction"><p className="eyebrow">Schema</p><h1 ref={surfaceHeadingRef} tabIndex={-1}>Define a relation and its dependencies.</h1><p>Model the facts your relation stores. SchemaWise will use this input to explain normalization step by step.</p></div>
      <section className="schema-editor" aria-label="Schema editor">
        <div className="editor-toolbar"><div><p className="eyebrow">Input</p><p className="editor-toolbar__note">Your draft stays in this browser tab.</p></div>{onRequestExample ? <button className="button button--quiet" type="button" onClick={onRequestExample}>Load example</button> : null}</div>
        {!navigationBlocked && confirmExample && onCancelExample && onLoadExample ? <div className="inline-confirmation example-confirmation" role="alert"><p>Loading the example will replace your current schema.</p><div className="button-row"><button className="button button--secondary" type="button" onClick={onCancelExample}>Keep current schema</button><button className="button button--danger-solid" type="button" onClick={onLoadExample}>Replace with example</button></div></div> : null}
        <RelationEditor name={state.draft.relationName} issues={issues} onChange={(name) => dispatch({ type: "changeRelationName", name })} />
        <AttributeList attributes={state.draft.attributes} dependencyReferenceCounts={referenceCounts} issues={issues} onAdd={(attribute) => dispatch({ type: "addAttribute", attribute })} onRename={(id, name) => dispatch({ type: "renameAttribute", id, name })} onRemove={(id) => dispatch({ type: "removeAttribute", id })} />
        <FunctionalDependencyEditor key={state.draft.attributes.map((attribute) => attribute.id).join("|")} attributes={state.draft.attributes} dependencies={state.draft.functionalDependencies} onAdd={(dependency) => dispatch({ type: "addFunctionalDependency", dependency })} onUpdate={(index, dependency) => dispatch({ type: "updateFunctionalDependency", index, dependency })} onRemove={(index) => dispatch({ type: "removeFunctionalDependency", index })} />
        <div className="analyze-action"><div><h2>Ready to analyze?</h2><p>Check candidate keys, normal forms, and the minimal cover.</p></div><button className="button button--primary analyze-button" type="button" onClick={() => void core.analyze()} disabled={issues.length > 0} aria-describedby={analyzeHelp ? "analyze-help" : presentedError ? "analysis-error" : undefined} title={isAnalyzing ? "Restart analysis with the current schema" : undefined}>{isAnalyzing ? "Analyzing…" : hasResult ? "Analyze again" : "Analyze schema"}</button><div className="analysis-live-status" role="status" aria-live="polite">{isAnalyzing ? (hasResult ? "Updating analysis…" : "Analyzing schema…") : ""}</div>{analyzeHelp ? <p className="analyze-help" id="analyze-help">{analyzeHelp}</p> : null}{presentedError ? <div className="analysis-error" id="analysis-error" role="alert"><strong>Analysis failed</strong><p>{presentedError.message}</p>{presentedError.code ? <span className="technical-error-code">Error code: {presentedError.code}</span> : null}</div> : null}<DelayedAsyncHint active={isAnalyzing} requestKey={state.analysis.requestId} /></div>
      </section>
      <ClosureTool attributes={state.draft.attributes} issues={issues} state={state.closure} onCalculate={core.calculateClosure} />
    </> : null}
    {activeView === "analysis" ? <section className="analysis-surface" aria-busy={isAnalyzing}><header className="surface-heading"><div><p className="eyebrow">Understand</p><h1 ref={surfaceHeadingRef} tabIndex={-1}>Analysis</h1><p>{hasResult ? "Understand the analyzed snapshot of this schema." : "Analyze the schema to see candidate keys, normal forms, and violations."}</p></div><Link className="button button--secondary" to={href("schema")} onClick={onNavigate}>Edit schema</Link></header><div className="analysis-live-status" role="status" aria-live="polite">{isAnalyzing ? (hasResult ? "Updating analysis…" : "Analyzing schema…") : state.analysis.status === "success" ? "Analysis complete." : ""}</div>{hasResult ? <><AnalysisResults result={state.analysis.data!} analyzedSnapshot={state.analysis.inputSnapshot!} outOfDate={state.analysis.outOfDate} /><div className="analysis-transform-link"><Link className="button button--secondary" to={href("transform")} onClick={onNavigate}>Explore transformations</Link></div></> : isAnalyzing ? <div className="surface-empty-state"><p>Analyzing the schema…</p><DelayedAsyncHint active={isAnalyzing} requestKey={state.analysis.requestId} /></div> : <div className="surface-empty-state"><p>{emptyAnalysisMessage}</p><Link className="button button--primary" to={href("schema")} onClick={onNavigate}>Go to Schema</Link></div>}</section> : null}
    {activeView === "transform" ? <TransformSurface analysis={hasResult ? state.analysis.data : undefined} snapshot={hasResult ? state.analysis.inputSnapshot : undefined} outOfDate={state.analysis.outOfDate} synthesis={state.synthesis} bcnf={state.bcnf} preservation={state.dependencyPreservation} synthesisError={state.synthesis.status === "error" ? transformationErrorMessage(state.synthesis.error) : undefined} bcnfError={state.bcnf.status === "error" ? transformationErrorMessage(state.bcnf.error) : undefined} preservationError={state.dependencyPreservation.status === "error" ? transformationErrorMessage(state.dependencyPreservation.error) : undefined} analysisHref={href("analysis")} schemaHref={href("schema")} onNavigate={onNavigate} onGenerateSynthesis={() => void core.generateSynthesis()} onGenerateBcnf={() => void core.generateBcnf()} onCheckPreservation={() => void core.checkDependencyPreservation()} headingRef={surfaceHeadingRef} /> : null}
  </>;
}
