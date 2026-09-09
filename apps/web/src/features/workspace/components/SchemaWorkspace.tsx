import { useEffect, useReducer, useRef, useState } from "react";
import { schemawiseApi, SchemaWiseApiError, type SchemaWiseApi } from "../../../api/schemawise-api";
import type { ErrorCode } from "../../../api/schemawise-contracts";
import { AttributeList } from "./AttributeList";
import { ClosureTool } from "./ClosureTool";
import { FunctionalDependencyEditor } from "./FunctionalDependencyEditor";
import { RelationEditor } from "./RelationEditor";
import { AnalysisResults } from "./AnalysisResults";
import { createInitialWorkspaceState, draftToSchemaRequest, workspaceReducer } from "../workspace-reducer";
import { validateDraft } from "../workspace-validation";

interface SchemaWorkspaceProps {
  readonly api?: SchemaWiseApi;
}

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

function focusFirstIssue(field: string) {
  const selector = field === "relationName" ? "#relation-name" : field.startsWith("attribute:") ? `#attribute-${CSS.escape(field.slice("attribute:".length))}` : field === "attributes" ? ".add-button" : "#dependencies-heading";
  document.querySelector<HTMLElement>(selector)?.focus();
}

export function SchemaWorkspace({ api = schemawiseApi }: SchemaWorkspaceProps) {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, createInitialWorkspaceState);
  const [confirmExample, setConfirmExample] = useState(false);
  const activeAnalysis = useRef<AbortController | undefined>(undefined);
  const activeSynthesis = useRef<AbortController | undefined>(undefined);
  const activeBcnf = useRef<AbortController | undefined>(undefined);
  const activePreservation = useRef<AbortController | undefined>(undefined);
  const activeClosure = useRef<AbortController | undefined>(undefined);
  const issues = validateDraft(state.draft);
  const isAnalyzing = state.analysis.status === "loading";
  const hasResult = state.analysis.data !== undefined && state.analysis.inputSnapshot !== undefined;
  const isPristine = state.draft.relationName === "" && state.draft.attributes.length === 0 && state.draft.functionalDependencies.length === 0;
  const referenceCounts = new Map(state.draft.attributes.map((attribute) => [
    attribute.id,
    state.draft.functionalDependencies.filter((dependency) => dependency.left.includes(attribute.id) || dependency.right.includes(attribute.id)).length,
  ]));

  function requestExample() {
    if (isPristine) dispatch({ type: "loadExample" });
    else setConfirmExample(true);
  }

  function loadExample() {
    dispatch({ type: "loadExample" });
    setConfirmExample(false);
  }

  useEffect(() => () => {
    activeAnalysis.current?.abort();
    activeSynthesis.current?.abort();
    activeBcnf.current?.abort();
    activePreservation.current?.abort();
    activeClosure.current?.abort();
  }, []);

  async function calculateClosure(selectedAttributes: readonly string[]) {
    const currentIssues = validateDraft(state.draft);
    if (currentIssues.length > 0) return;
    activeClosure.current?.abort();
    const controller = new AbortController();
    activeClosure.current = controller;
    const requestId = crypto.randomUUID();
    const inputRevision = state.revision;
    const inputSnapshot = draftToSchemaRequest(state.draft);
    dispatch({ type: "closureRequestStart", requestId, inputRevision, inputSnapshot, selectedAttributes });
    try {
      const data = await api.calculateClosure({ ...inputSnapshot, attributes: [...selectedAttributes] }, controller.signal);
      dispatch({ type: "closureSuccess", requestId, data });
    } catch (error) {
      if (error instanceof SchemaWiseApiError && error.kind === "aborted") dispatch({ type: "closureAborted", requestId });
      else dispatch({ type: "closureError", requestId, error });
    } finally {
      if (activeClosure.current === controller) activeClosure.current = undefined;
    }
  }

  async function analyze() {
    const currentIssues = validateDraft(state.draft);
    if (currentIssues.length > 0) {
      const first = currentIssues[0];
      if (first) focusFirstIssue(first.field);
      return;
    }
    activeAnalysis.current?.abort();
    const controller = new AbortController();
    activeAnalysis.current = controller;
    const requestId = crypto.randomUUID();
    const inputRevision = state.revision;
    const inputSnapshot = draftToSchemaRequest(state.draft);
    dispatch({ type: "analysisRequestStart", requestId, inputRevision, inputSnapshot });
    try {
      const data = await api.analyzeSchema(inputSnapshot, controller.signal);
      dispatch({ type: "analysisSuccess", requestId, data });
    } catch (error) {
      if (error instanceof SchemaWiseApiError && error.kind === "aborted") {
        dispatch({ type: "analysisAborted", requestId });
        return;
      }
      dispatch({ type: "analysisError", requestId, error });
    } finally {
      if (activeAnalysis.current === controller) activeAnalysis.current = undefined;
    }
  }

  async function generateSynthesis() {
    if (!state.analysis.inputSnapshot || state.analysis.outOfDate) return;
    activeSynthesis.current?.abort();
    const controller = new AbortController();
    activeSynthesis.current = controller;
    const requestId = crypto.randomUUID();
    const inputSnapshot = state.analysis.inputSnapshot;
    dispatch({ type: "synthesisRequestStart", requestId });
    try {
      const data = await api.synthesizeThirdNormalForm(inputSnapshot, controller.signal);
      dispatch({ type: "synthesisSuccess", requestId, data });
    } catch (error) {
      if (error instanceof SchemaWiseApiError && error.kind === "aborted") dispatch({ type: "synthesisAborted", requestId });
      else dispatch({ type: "synthesisError", requestId, error });
    } finally {
      if (activeSynthesis.current === controller) activeSynthesis.current = undefined;
    }
  }

  async function generateBcnf() {
    if (!state.analysis.inputSnapshot || state.analysis.outOfDate) return;
    activeBcnf.current?.abort();
    const controller = new AbortController();
    activeBcnf.current = controller;
    const requestId = crypto.randomUUID();
    const inputSnapshot = state.analysis.inputSnapshot;
    dispatch({ type: "bcnfRequestStart", requestId });
    try {
      const data = await api.decomposeBoyceCodd(inputSnapshot, controller.signal);
      dispatch({ type: "bcnfSuccess", requestId, data });
    } catch (error) {
      if (error instanceof SchemaWiseApiError && error.kind === "aborted") dispatch({ type: "bcnfAborted", requestId });
      else dispatch({ type: "bcnfError", requestId, error });
    } finally {
      if (activeBcnf.current === controller) activeBcnf.current = undefined;
    }
  }

  async function checkDependencyPreservation() {
    if (!state.analysis.inputSnapshot || !state.bcnf.data || state.analysis.outOfDate) return;
    activePreservation.current?.abort();
    const controller = new AbortController();
    activePreservation.current = controller;
    const requestId = crypto.randomUUID();
    const inputSnapshot = state.analysis.inputSnapshot;
    const request = { ...inputSnapshot, decomposition: state.bcnf.data.relations.map((relation) => [...relation.attributes]) };
    dispatch({ type: "preservationRequestStart", requestId });
    try {
      const data = await api.analyzeDependencyPreservation(request, controller.signal);
      dispatch({ type: "preservationSuccess", requestId, data });
    } catch (error) {
      if (error instanceof SchemaWiseApiError && error.kind === "aborted") dispatch({ type: "preservationAborted", requestId });
      else dispatch({ type: "preservationError", requestId, error });
    } finally {
      if (activePreservation.current === controller) activePreservation.current = undefined;
    }
  }

  const presentedError = state.analysis.status === "error" ? analysisErrorMessage(state.analysis.error) : undefined;
  const firstIssue = issues[0];
  const analyzeHelp = firstIssue ? (issues.filter((issue) => issue.message === firstIssue.message).length > 1 ? "Resolve the highlighted schema errors before analyzing." : firstIssue.message) : undefined;

  return (
    <div className="workspace-layout">
      <div className="workspace-primary">
      <section className="schema-editor" aria-label="Schema editor">
        <div className="editor-toolbar">
          <div>
            <p className="eyebrow">Input</p>
            <p className="editor-toolbar__note">Your draft stays in this browser tab.</p>
          </div>
          <button className="button button--quiet" type="button" onClick={requestExample}>Load example</button>
        </div>
        {confirmExample ? (
          <div className="inline-confirmation example-confirmation" role="alert">
            <p>Loading the example will replace your current schema.</p>
            <div className="button-row">
              <button className="button button--secondary" type="button" onClick={() => setConfirmExample(false)}>Keep current schema</button>
              <button className="button button--danger-solid" type="button" onClick={loadExample}>Replace with example</button>
            </div>
          </div>
        ) : null}
        <RelationEditor name={state.draft.relationName} issues={issues} onChange={(name) => dispatch({ type: "changeRelationName", name })} />
        <AttributeList
          attributes={state.draft.attributes}
          dependencyReferenceCounts={referenceCounts}
          issues={issues}
          onAdd={(attribute) => dispatch({ type: "addAttribute", attribute })}
          onRename={(id, name) => dispatch({ type: "renameAttribute", id, name })}
          onRemove={(id) => dispatch({ type: "removeAttribute", id })}
        />
        <FunctionalDependencyEditor
          key={state.draft.attributes.map((attribute) => attribute.id).join("|")}
          attributes={state.draft.attributes}
          dependencies={state.draft.functionalDependencies}
          onAdd={(dependency) => dispatch({ type: "addFunctionalDependency", dependency })}
          onUpdate={(index, dependency) => dispatch({ type: "updateFunctionalDependency", index, dependency })}
          onRemove={(index) => dispatch({ type: "removeFunctionalDependency", index })}
        />
        <div className="analyze-action">
          <div>
            <h2>Ready to analyze?</h2>
            <p>Check candidate keys, normal forms, and the minimal cover.</p>
          </div>
          <button className="button button--primary analyze-button" type="button" onClick={analyze} disabled={issues.length > 0} aria-describedby={analyzeHelp ? "analyze-help" : presentedError ? "analysis-error" : undefined} title={isAnalyzing ? "Restart analysis with the current schema" : undefined}>
            {isAnalyzing ? "Analyzing…" : hasResult ? "Analyze again" : "Analyze schema"}
          </button>
          {analyzeHelp ? <p className="analyze-help" id="analyze-help">{analyzeHelp}</p> : null}
          {presentedError ? (
            <div className="analysis-error" id="analysis-error" role="alert">
              <strong>Analysis failed</strong>
              <p>{presentedError.message}</p>
              {presentedError.code ? <span className="technical-error-code">Error code: {presentedError.code}</span> : null}
            </div>
          ) : null}
        </div>
      </section>
      <ClosureTool attributes={state.draft.attributes} issues={issues} state={state.closure} onCalculate={calculateClosure} />
      </div>
      <aside className="results-region" aria-label="Analysis results" aria-busy={isAnalyzing}>
        <div className="analysis-live-status" role="status" aria-live="polite">
          {isAnalyzing ? (hasResult ? "Updating analysis…" : "Analyzing schema…") : state.analysis.status === "success" ? "Analysis complete." : ""}
        </div>
        {hasResult ? <AnalysisResults
          result={state.analysis.data!}
          analyzedSnapshot={state.analysis.inputSnapshot!}
          outOfDate={state.analysis.outOfDate}
          synthesis={state.synthesis}
          bcnf={state.bcnf}
          preservation={state.dependencyPreservation}
          synthesisError={state.synthesis.status === "error" ? transformationErrorMessage(state.synthesis.error) : undefined}
          bcnfError={state.bcnf.status === "error" ? transformationErrorMessage(state.bcnf.error) : undefined}
          preservationError={state.dependencyPreservation.status === "error" ? transformationErrorMessage(state.dependencyPreservation.error) : undefined}
          onGenerateSynthesis={generateSynthesis}
          onGenerateBcnf={generateBcnf}
          onCheckPreservation={checkDependencyPreservation}
        /> : isAnalyzing ? (
          <div className="results-placeholder"><p className="eyebrow">Results</p><p>Analyzing the schema…</p></div>
        ) : (
          <div className="results-placeholder"><p className="eyebrow">Results</p><p>Define your relation and dependencies, then analyze the schema.</p></div>
        )}
      </aside>
    </div>
  );
}
