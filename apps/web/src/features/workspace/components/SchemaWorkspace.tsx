import { useEffect, useReducer, useRef, useState } from "react";
import { schemawiseApi, SchemaWiseApiError, type SchemaWiseApi } from "../../../api/schemawise-api";
import { projectApi as defaultProjectApi, type ProjectApi } from "../../../api/project-api";
import { HttpApiError } from "../../../api/http-api";
import type { ErrorCode } from "../../../api/schemawise-contracts";
import type { ProjectSummaryDto } from "../../../api/schemawise-contracts";
import { AuthPanel } from "../../auth/AuthPanel";
import { useAuth } from "../../auth/auth-context";
import { ProjectListPanel } from "../../projects/ProjectListPanel";
import { draftToPersistedSchema, initialProjectSession, isProjectDirty, persistedSchemaToDraft, sessionFromProject, type ProjectSession } from "../../projects/project-session";
import { AttributeList } from "./AttributeList";
import { ClosureTool } from "./ClosureTool";
import { FunctionalDependencyEditor } from "./FunctionalDependencyEditor";
import { RelationEditor } from "./RelationEditor";
import { AnalysisResults } from "./AnalysisResults";
import { createInitialWorkspaceState, draftToSchemaRequest, workspaceReducer } from "../workspace-reducer";
import { validateDraft } from "../workspace-validation";

interface SchemaWorkspaceProps {
  readonly api?: SchemaWiseApi;
  readonly projectsApi?: ProjectApi;
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

export function SchemaWorkspace({ api = schemawiseApi, projectsApi = defaultProjectApi }: SchemaWorkspaceProps) {
  const auth = useAuth();
  const [state, dispatch] = useReducer(workspaceReducer, undefined, createInitialWorkspaceState);
  const [project, setProject] = useState<ProjectSession>(initialProjectSession);
  const [authOpen, setAuthOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectList, setProjectList] = useState<readonly ProjectSummaryDto[]>([]);
  const [projectBusy, setProjectBusy] = useState(false);
  const [projectError, setProjectError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [pendingReplace, setPendingReplace] = useState<{ type: "new" } | { type: "open"; id: string }>();
  const [pendingDelete, setPendingDelete] = useState<ProjectSummaryDto | { id: string; name: string }>();
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
  const dirty = isProjectDirty(project, state.draft);
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

  useEffect(() => {
    if (auth.status === "unauthenticated" && project.projectId) setProject((current) => ({ ...current, syncUnavailable: true }));
    if (auth.status === "authenticated") setProject((current) => current.syncUnavailable ? { ...current, syncUnavailable: false } : current);
  }, [auth.status, project.projectId]);

  function persistenceErrorMessage(error: unknown): string {
    if (error instanceof HttpApiError) {
      if (error.kind === "network") return "We couldn't reach SchemaWise. Your local workspace is unchanged.";
      if (error.code === "INVALID_PROJECT") return "This project could not be saved. Check its name and schema.";
      if (error.code === "PROJECT_NOT_FOUND") return "That project could not be found.";
      if (error.code === "PROJECT_LIMIT_EXCEEDED") return "This project exceeds the persistence limits.";
      if (error.code === "PERSISTENCE_ERROR") return "Project storage is temporarily unavailable. Try again.";
    }
    return "The project operation failed. Your local workspace is unchanged.";
  }

  async function handleProjectFailure(error: unknown) {
    if (error instanceof HttpApiError && error.status === 401) {
      auth.setUnauthenticated();
      setProject((current) => ({ ...current, syncUnavailable: true }));
      setProjectError("Sign in to continue saving. Your local workspace is unchanged.");
      return;
    }
    if (error instanceof HttpApiError && error.status === 403 && error.code === "INVALID_CSRF_TOKEN") {
      await auth.refreshSession();
      setProjectError("The security check failed. Your session was refreshed; retry the action yourself.");
      return;
    }
    setProjectError(persistenceErrorMessage(error));
  }

  async function saveProject() {
    if (auth.status !== "authenticated" || !auth.csrfToken) { setAuthOpen(true); return; }
    if (project.name.trim().length === 0) { setProjectError("Project name is required."); return; }
    setProjectBusy(true); setProjectError(undefined);
    try {
      const schema = draftToPersistedSchema(state.draft);
      const saved = project.projectId && project.serverRevision
        ? await projectsApi.updateProject(project.projectId, { name: project.name, schema, expectedRevision: project.serverRevision }, auth.csrfToken)
        : await projectsApi.createProject({ name: project.name, schema }, auth.csrfToken);
      setProject(sessionFromProject(saved, state.revision));
      setConflict(false);
    } catch (error) {
      if (error instanceof HttpApiError && error.status === 409 && error.code === "PROJECT_REVISION_CONFLICT") setConflict(true);
      else await handleProjectFailure(error);
    } finally { setProjectBusy(false); }
  }

  async function openProjectList() {
    if (auth.status !== "authenticated") { setAuthOpen(true); return; }
    setProjectsOpen(true); setProjectBusy(true); setProjectError(undefined);
    try { setProjectList((await projectsApi.listProjects(20, 0)).projects); }
    catch (error) { await handleProjectFailure(error); }
    finally { setProjectBusy(false); }
  }

  function requestOpen(id: string) {
    if (dirty) setPendingReplace({ type: "open", id });
    else void loadProject(id);
  }

  async function loadProject(id: string) {
    setProjectBusy(true); setProjectError(undefined);
    try {
      const loaded = await projectsApi.getProject(id);
      dispatch({ type: "replaceDraft", draft: persistedSchemaToDraft(loaded.schema) });
      setProject(sessionFromProject(loaded, state.revision + 1));
      setProjectsOpen(false); setPendingReplace(undefined); setConflict(false);
    } catch (error) { await handleProjectFailure(error); }
    finally { setProjectBusy(false); }
  }

  function requestNew() {
    if (dirty) setPendingReplace({ type: "new" });
    else newProject();
  }

  function newProject() {
    dispatch({ type: "resetWorkspace" });
    setProject(initialProjectSession); setConflict(false); setProjectError(undefined); setPendingReplace(undefined); setProjectsOpen(false);
  }

  async function confirmDelete() {
    if (!pendingDelete || !auth.csrfToken) return;
    setProjectBusy(true); setProjectError(undefined);
    try {
      await projectsApi.deleteProject(pendingDelete.id, auth.csrfToken);
      if (pendingDelete.id === project.projectId) setProject({ ...initialProjectSession, name: project.name });
      setProjectList((current) => current.filter(({ id }) => id !== pendingDelete.id));
      setPendingDelete(undefined);
    } catch (error) { await handleProjectFailure(error); }
    finally { setProjectBusy(false); }
  }

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
    <>
    <section className="project-bar" aria-label="Project controls">
      <div className="project-title-field"><label htmlFor="project-name">Project name</label><input id="project-name" type="text" maxLength={120} value={project.name} onChange={(event) => setProject((current) => ({ ...current, name: event.target.value }))} /></div>
      <span className={`save-state ${dirty ? "save-state--dirty" : ""}`} aria-live="polite">{project.syncUnavailable ? "Sync unavailable" : project.savedSnapshot && !dirty ? "Saved" : dirty ? "Unsaved changes" : "Not saved"}</span>
      <div className="project-actions">
        <button className="button button--secondary" type="button" onClick={requestNew}>New project</button>
        <button className="button button--secondary" type="button" onClick={() => void openProjectList()}>Open projects</button>
        <button className="button button--primary" type="button" onClick={() => void saveProject()} disabled={projectBusy}>{projectBusy ? "Working…" : "Save"}</button>
        {auth.status === "authenticated" ? <><span className="account-email">{auth.user?.email}</span><button className="button button--quiet" type="button" onClick={() => void auth.logout()}>Logout</button></> : <button className="button button--quiet" type="button" onClick={() => setAuthOpen(true)}>{auth.status === "unknown" ? "Checking session…" : "Sign in"}</button>}
      </div>
    </section>
    {auth.initializationError ? <p className="project-notice" role="status">{auth.initializationError}</p> : null}
    {projectError ? <div className="project-notice project-notice--error" role="alert"><p>{projectError}</p><button className="button button--quiet" type="button" onClick={() => setProjectError(undefined)}>Dismiss</button></div> : null}
    {authOpen ? <AuthPanel onClose={() => setAuthOpen(false)} /> : null}
    {projectsOpen ? <ProjectListPanel projects={projectList} loading={projectBusy} {...(projectError ? { error: projectError } : {})} onOpen={requestOpen} onDelete={setPendingDelete} onClose={() => setProjectsOpen(false)} /> : null}
    {pendingReplace ? <div className="inline-confirmation" role="alert"><p>Discard unsaved changes?</p><div className="button-row"><button className="button button--secondary" type="button" onClick={() => setPendingReplace(undefined)}>Cancel</button><button className="button button--danger-solid" type="button" onClick={() => pendingReplace.type === "new" ? newProject() : void loadProject(pendingReplace.id)}>Discard and continue</button></div></div> : null}
    {pendingDelete ? <div className="inline-confirmation" role="alert"><p>Delete “{pendingDelete.name}” permanently?</p><div className="button-row"><button className="button button--secondary" type="button" onClick={() => setPendingDelete(undefined)}>Cancel</button><button className="button button--danger-solid" type="button" onClick={() => void confirmDelete()}>Delete project</button></div></div> : null}
    {conflict ? <section className="conflict-panel" aria-labelledby="conflict-heading"><h2 id="conflict-heading">This project was updated elsewhere.</h2><p>The saved version changed since you opened this project. Your changes have not been overwritten.</p><div className="button-row"><button className="button button--primary" type="button" onClick={() => project.projectId && void loadProject(project.projectId)}>Reload saved version</button><button className="button button--secondary" type="button" onClick={() => setConflict(false)}>Cancel</button></div></section> : null}
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
    </>
  );
}
