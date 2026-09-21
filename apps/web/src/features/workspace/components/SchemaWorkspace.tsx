import { useEffect, useReducer, useRef, useState } from "react";
import { Link, MemoryRouter, useInRouterContext, useLocation } from "react-router-dom";
import { DelayedAsyncHint } from "../../../components/DelayedAsyncHint";
import { schemawiseApi, SchemaWiseApiError, type SchemaWiseApi } from "../../../api/schemawise-api";
import { projectApi as defaultProjectApi, type ProjectApi } from "../../../api/project-api";
import { HttpApiError } from "../../../api/http-api";
import type { ErrorCode, ProjectDto, ProjectSummaryDto } from "../../../api/schemawise-contracts";
import { AuthPanel } from "../../auth/AuthPanel";
import { useAuth } from "../../auth/auth-context";
import { ProjectListPanel } from "../../projects/ProjectListPanel";
import { ProjectNavigationPrompt, useProjectNavigation } from "../../projects/project-navigation";
import { useProjectRouteCoordination } from "../../projects/project-route-context";
import { draftToPersistedSchema, initialProjectSession, isProjectDirty, isRouteLoadedProjectCoherent, persistedSchemaToDraft, sessionFromProject, type ProjectSession } from "../../projects/project-session";
import { AttributeList } from "./AttributeList";
import { ClosureTool } from "./ClosureTool";
import { FunctionalDependencyEditor } from "./FunctionalDependencyEditor";
import { RelationEditor } from "./RelationEditor";
import { AnalysisResults } from "./AnalysisResults";
import { TransformSurface } from "./TransformSurface";
import { createInitialWorkspaceState, draftToSchemaRequest, workspaceReducer } from "../workspace-reducer";
import { validateDraft } from "../workspace-validation";
import { WorkspaceViewProvider, useWorkspaceView } from "../workspace-view-navigation";
import { setWorkspaceView, type WorkspaceView } from "../workspace-view";
import schemawiseBirds from "../../../assets/schemawise-birds.webp";

interface SchemaWorkspaceProps {
  readonly api?: SchemaWiseApi;
  readonly projectsApi?: ProjectApi;
  readonly initialProject?: ProjectDto;
  readonly focusAfterHydration?: boolean;
}

function WorkspaceNavigation({ activeView, onNavigate }: { readonly activeView: WorkspaceView; readonly onNavigate: (view: WorkspaceView) => void }) {
  const location = useLocation();
  const href = (view: WorkspaceView) => `${location.pathname}${(() => { const params = setWorkspaceView(new URLSearchParams(location.search), view); const search = params.toString(); return search ? `?${search}` : ""; })()}`;
  return <nav className="workspace-navigation" aria-label="Workspace">
    {(["schema", "analysis", "transform"] as const).map((view) => <Link key={view} className="workspace-navigation__link" to={href(view)} aria-current={activeView === view ? "page" : undefined} onClick={() => onNavigate(view)}>{view === "schema" ? "Schema" : view === "analysis" ? "Analysis" : "Transform"}</Link>)}
  </nav>;
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

function SchemaWorkspaceContent({ api = schemawiseApi, projectsApi = defaultProjectApi, initialProject, focusAfterHydration = false }: SchemaWorkspaceProps) {
  const auth = useAuth();
  const navigation = useProjectNavigation();
  const route = useProjectRouteCoordination();
  const { activeView, goToAnalysis } = useWorkspaceView();
  const location = useLocation();
  const [state, dispatch] = useReducer(workspaceReducer, initialProject, (loaded) => loaded
    ? workspaceReducer(createInitialWorkspaceState(), { type: "replaceDraft", draft: persistedSchemaToDraft(loaded.schema) })
    : createInitialWorkspaceState());
  const [project, setProject] = useState<ProjectSession>(() => initialProject ? sessionFromProject(initialProject) : initialProjectSession);
  const [authOpen, setAuthOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectList, setProjectList] = useState<readonly ProjectSummaryDto[]>([]);
  const [projectTotal, setProjectTotal] = useState(0);
  const [projectBusy, setProjectBusy] = useState(false);
  const [projectError, setProjectError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [confirmConflictReload, setConfirmConflictReload] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectSummaryDto | { id: string; name: string }>();
  const [confirmExample, setConfirmExample] = useState(false);
  const activeAnalysis = useRef<AbortController | undefined>(undefined);
  const activeSynthesis = useRef<AbortController | undefined>(undefined);
  const activeBcnf = useRef<AbortController | undefined>(undefined);
  const activePreservation = useRef<AbortController | undefined>(undefined);
  const activeClosure = useRef<AbortController | undefined>(undefined);
  const authReturnFocus = useRef<HTMLElement | null>(null);
  const projectsReturnFocus = useRef<HTMLElement | null>(null);
  const deleteReturnFocus = useRef<HTMLElement | null>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const conflictHeadingRef = useRef<HTMLHeadingElement>(null);
  const conflictKeepRef = useRef<HTMLButtonElement>(null);
  const projectNameRef = useRef<HTMLInputElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const surfaceHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusSurfaceAfterNavigation = useRef(false);
  const hydrationFocusMoved = useRef(false);
  const issues = validateDraft(state.draft);
  const isAnalyzing = state.analysis.status === "loading";
  const hasResult = state.analysis.data !== undefined && state.analysis.inputSnapshot !== undefined;
  const isPristine = state.draft.relationName === "" && state.draft.attributes.length === 0 && state.draft.functionalDependencies.length === 0;
  const dirty = isProjectDirty(project, state.draft);
  const rootTransitionKeyRef = useRef(navigation?.rootTransitionKey);
  const appliedProjectRef = useRef(initialProject);
  const savedAdoptionRef = useRef<{ id: string; revision: number } | undefined>(undefined);
  const handledRouteErrorRef = useRef<string | undefined>(undefined);
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
    if (auth.status === "unauthenticated" && project.loadedProjectId) setProject((current) => ({ ...current, syncUnavailable: true }));
    if (auth.status === "authenticated") setProject((current) => current.syncUnavailable ? { ...current, syncUnavailable: false } : current);
  }, [auth.status, project.loadedProjectId]);

  useEffect(() => {
    if (!initialProject || appliedProjectRef.current === initialProject) return;
    appliedProjectRef.current = initialProject;
    if (savedAdoptionRef.current?.id === initialProject.id && savedAdoptionRef.current.revision === initialProject.revision) {
      savedAdoptionRef.current = undefined;
      return;
    }
    activeAnalysis.current?.abort(); activeSynthesis.current?.abort(); activeBcnf.current?.abort(); activePreservation.current?.abort(); activeClosure.current?.abort();
    dispatch({ type: "replaceDraft", draft: persistedSchemaToDraft(initialProject.schema) });
    setProject(sessionFromProject(initialProject));
    setProjectsOpen(false); setConflict(false); setConfirmConflictReload(false); setProjectError(undefined);
    if (route?.hydrationReason === "reload") setTimeout(() => projectNameRef.current?.focus());
  }, [initialProject, route?.hydrationReason]);

  useEffect(() => navigation?.setDirty(dirty), [dirty, navigation]);
  useEffect(() => route?.reportVisibleSession({ ...(project.loadedProjectId ? { loadedProjectId: project.loadedProjectId } : {}), dirty }), [dirty, project.loadedProjectId, route]);
  useEffect(() => {
    if (route?.hydrationStatus !== "error" || route.hydrationReason !== "reload") return;
    const key = `${route.routeProjectId}:reload:error`;
    if (handledRouteErrorRef.current === key) return;
    handledRouteErrorRef.current = key;
    setProjectError("Could not load the saved version. Your local draft is unchanged.");
  }, [route?.hydrationReason, route?.hydrationStatus, route?.routeProjectId]);
  useEffect(() => {
    if (!navigation?.rootTransitionKey || rootTransitionKeyRef.current === navigation.rootTransitionKey) return;
    rootTransitionKeyRef.current = navigation.rootTransitionKey;
    const detach = navigation.consumeDetachIntent();
    if (detach) {
      setProject((current) => ({ ...initialProjectSession, name: current.name, detached: true }));
      setConflict(false); setConfirmConflictReload(false); setProjectError(detach.message); setProjectsOpen(false); setPendingDelete(undefined);
    } else newProject();
  }, [navigation?.rootTransitionKey]);
  useEffect(() => { if (pendingDelete) deleteCancelRef.current?.focus(); }, [pendingDelete]);
  useEffect(() => { if (conflict) conflictHeadingRef.current?.focus(); }, [conflict]);
  useEffect(() => { if (confirmConflictReload) conflictKeepRef.current?.focus(); }, [confirmConflictReload]);
  useEffect(() => {
    if (focusAfterHydration && !hydrationFocusMoved.current) {
      hydrationFocusMoved.current = true;
      surfaceHeadingRef.current?.focus();
    }
  }, [focusAfterHydration, initialProject]);
  useEffect(() => {
    if (!focusSurfaceAfterNavigation.current) return;
    focusSurfaceAfterNavigation.current = false;
    surfaceHeadingRef.current?.focus();
  }, [activeView]);

  function openAuth() {
    authReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAuthOpen(true);
  }

  function closeAuth() {
    setAuthOpen(false);
    setTimeout(() => { authReturnFocus.current?.focus(); authReturnFocus.current = null; });
  }

  function closeProjects() {
    setProjectsOpen(false);
    setTimeout(() => { projectsReturnFocus.current?.focus(); projectsReturnFocus.current = null; });
  }

  function detachUnavailableProject() {
    navigation?.detachCurrentProject("The saved project is no longer available. Your changes are still here and can be saved as a new project.");
  }

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
      setProjectError("Sign in to save this project.");
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
    if (auth.status !== "authenticated" || !auth.csrfToken) { openAuth(); return; }
    if (project.name.trim().length === 0) { setProjectError("Project name is required."); return; }
    const coherentExisting = isRouteLoadedProjectCoherent(route?.routeProjectId, project.loadedProjectId);
    if (project.loadedProjectId && !coherentExisting) { setProjectError("This project is reconnecting. Wait for the saved version before saving."); return; }
    setProjectBusy(true); setProjectError(undefined);
    try {
      const schema = draftToPersistedSchema(state.draft);
      const isExisting = Boolean(coherentExisting && project.serverRevision);
      const saved = isExisting
        ? await projectsApi.updateProject(project.loadedProjectId!, { name: project.name, schema, expectedRevision: project.serverRevision! }, auth.csrfToken)
        : await projectsApi.createProject({ name: project.name, schema }, auth.csrfToken);
      setProject(sessionFromProject(saved));
      setConflict(false);
      if (!isExisting) {
        savedAdoptionRef.current = { id: saved.id, revision: saved.revision };
        navigation?.adoptCreatedProject(saved);
      }
      else navigation?.updateCurrentProjectTitle(saved.name);
    } catch (error) {
      if (error instanceof HttpApiError && error.status === 409 && error.code === "PROJECT_REVISION_CONFLICT") { setConfirmConflictReload(false); setConflict(true); }
      else if (error instanceof HttpApiError && error.status === 404 && error.code === "PROJECT_NOT_FOUND") detachUnavailableProject();
      else await handleProjectFailure(error);
    } finally { setProjectBusy(false); }
  }

  async function openProjectList() {
    if (auth.status !== "authenticated") { openAuth(); return; }
    projectsReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setProjectsOpen(true); setProjectBusy(true); setProjectError(undefined);
    try { const result = await projectsApi.listProjects(20, 0); setProjectList(result.projects); setProjectTotal(result.total); }
    catch (error) { await handleProjectFailure(error); }
    finally { setProjectBusy(false); }
  }

  function requestOpen(id: string) {
    navigation?.navigateToProject(id, document.activeElement instanceof HTMLElement ? document.activeElement : null);
  }

  function requestNew() {
    if (navigation) navigation.navigateToRoot(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    else newProject();
  }

  function newProject() {
    dispatch({ type: "resetWorkspace" });
    setProject(initialProjectSession); setConflict(false); setConfirmConflictReload(false); setProjectError(undefined); setProjectsOpen(false);
    setTimeout(() => projectNameRef.current?.focus());
  }

  async function confirmDelete() {
    if (!pendingDelete || !auth.csrfToken) return;
    setProjectBusy(true); setProjectError(undefined);
    try {
      await projectsApi.deleteProject(pendingDelete.id, auth.csrfToken);
      const deletingCurrent = pendingDelete.id === project.loadedProjectId;
      setProjectList((current) => current.filter(({ id }) => id !== pendingDelete.id));
      setPendingDelete(undefined);
      if (deletingCurrent) navigation?.detachCurrentProject("The saved project is no longer available. Your changes are still here and can be saved as a new project.");
      else setTimeout(() => document.querySelector<HTMLButtonElement>(".projects-panel .panel-heading button")?.focus());
    } catch (error) {
      if (error instanceof HttpApiError && error.status === 404 && error.code === "PROJECT_NOT_FOUND") {
        const deletingCurrent = pendingDelete.id === project.loadedProjectId;
        if (deletingCurrent) detachUnavailableProject();
        else setProjectError("The saved project is no longer available.");
        setProjectList((current) => current.filter(({ id }) => id !== pendingDelete.id));
        setPendingDelete(undefined);
        if (!deletingCurrent) setTimeout(() => document.querySelector<HTMLButtonElement>(".projects-panel .panel-heading button")?.focus());
      } else await handleProjectFailure(error);
    }
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
      focusSurfaceAfterNavigation.current = true;
      goToAnalysis();
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
  const routeHydrating = route?.hydrationStatus === "loading";
  const routeLoadedCoherently = !project.loadedProjectId || isRouteLoadedProjectCoherent(route?.routeProjectId, project.loadedProjectId);
  const saveState = routeHydrating
    ? route?.hydrationReason === "reload" ? "Loading saved version" : "Reconnecting"
    : project.syncUnavailable ? "Sign in to save"
    : project.persistedSnapshot && !dirty ? "Saved"
    : dirty ? "Unsaved changes" : "Not saved";

  const contextRelation = state.draft.relationName.trim() || "Untitled relation";
  const contextCounts = `${state.draft.attributes.length} attributes · ${state.draft.functionalDependencies.length} dependencies`;

  return (
    <div className="workspace-shell">
      <header className="workspace-context">
        <div className="workspace-context__identity">
          <p className="eyebrow">{project.loadedProjectId ? "Project" : "Local schema"}</p>
          <p className="workspace-context__name">{project.name.trim() || contextRelation}</p>
          <p className="workspace-context__meta">{contextRelation} · {contextCounts}</p>
        </div>
        <WorkspaceNavigation activeView={activeView} onNavigate={(view) => { if (view !== activeView) focusSurfaceAfterNavigation.current = true; }} />
        <span className={`save-state ${dirty ? "save-state--dirty" : ""}`} aria-live="polite"><span>{saveState}</span>{activeView !== "schema" && hasResult ? <span className={state.analysis.outOfDate ? "analysis-currency--stale" : "analysis-currency"}>{state.analysis.outOfDate ? "Out of date" : "Current"}</span> : null}</span>
      </header>
      <section className="project-bar" aria-label="Project controls">
        <div className="project-title-field"><label htmlFor="project-name">Project name</label><input ref={projectNameRef} id="project-name" type="text" maxLength={120} value={project.name} onChange={(event) => setProject((current) => ({ ...current, name: event.target.value }))} /></div>
        <div className="project-actions">
          <button className="button button--quiet" type="button" onClick={requestNew}>New project</button>
          <button className="button button--quiet" type="button" onClick={() => void openProjectList()}>Open projects</button>
          <button ref={saveButtonRef} className="button button--secondary" type="button" onClick={() => void saveProject()} disabled={projectBusy || routeHydrating || !routeLoadedCoherently}>{projectBusy ? "Working…" : "Save"}</button>
          {auth.status === "authenticated" ? <><span className="account-email">{auth.user?.email}</span><button className="button button--quiet" type="button" onClick={() => void auth.logout()}>Log out</button></> : <button className="button button--quiet" type="button" onClick={openAuth}>{auth.status === "unknown" ? "Checking session…" : "Sign in"}</button>}
        </div>
      </section>
      <ProjectNavigationPrompt />
      {auth.initializationError ? <p className="project-notice" role="status">{auth.initializationError}</p> : null}
      {auth.sessionError ? <p className="project-notice project-notice--error" role="alert">{auth.sessionError}</p> : null}
      {route?.dirtyReconnectPreserved && dirty && auth.status === "authenticated" ? <p className="project-notice" role="status">Signed in. This project has unsaved local changes.</p> : null}
      {projectError ? <div className="project-notice project-notice--error" role="alert"><p>{projectError}</p><button className="button button--quiet" type="button" onClick={() => setProjectError(undefined)}>Dismiss</button></div> : null}
      {authOpen ? <AuthPanel onClose={closeAuth} /> : null}
      {projectsOpen ? <ProjectListPanel projects={projectList} total={projectTotal} loading={projectBusy} {...(projectError ? { error: projectError } : {})} onOpen={requestOpen} onDelete={(selected) => { deleteReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setPendingDelete(selected); }} onClose={closeProjects} /> : null}
      {!navigation?.blocked && pendingDelete ? <div className="inline-confirmation" role="alert"><p>Delete “{pendingDelete.name}” permanently?</p><div className="button-row"><button ref={deleteCancelRef} className="button button--secondary" type="button" onClick={() => { setPendingDelete(undefined); setTimeout(() => deleteReturnFocus.current?.focus()); }}>Cancel</button><button className="button button--danger-solid" type="button" onClick={() => void confirmDelete()}>Delete project</button></div></div> : null}
      {!navigation?.blocked && conflict ? <section className="conflict-panel" aria-labelledby="conflict-heading"><h2 ref={conflictHeadingRef} tabIndex={-1} id="conflict-heading">This project was updated elsewhere.</h2><p>The saved version changed since you opened this project. Your changes have not been overwritten. Reloading will permanently discard your unsaved local changes.</p>{confirmConflictReload ? <div className="inline-confirmation" role="alert"><p>Discard local changes and reload the saved version?</p><div className="button-row"><button ref={conflictKeepRef} className="button button--secondary" type="button" onClick={() => { setConfirmConflictReload(false); setTimeout(() => conflictHeadingRef.current?.focus()); }}>Keep local changes</button><button className="button button--danger-solid" type="button" disabled={routeHydrating} onClick={() => route?.rehydrateCurrentRoute()}>Reload and discard</button></div></div> : <div className="button-row"><button className="button button--primary" type="button" onClick={() => setConfirmConflictReload(true)}>Reload saved version</button><button className="button button--secondary" type="button" onClick={() => { setConflict(false); setTimeout(() => saveButtonRef.current?.focus()); }}>Cancel</button></div>}</section> : null}
      {activeView === "schema" ? <>
      <div className="page-introduction">
        <div className="page-introduction__copy"><p className="eyebrow">Schema</p><h1 ref={surfaceHeadingRef} tabIndex={-1}>Define a relation and its dependencies.</h1><p>Model the facts your relation stores. SchemaWise will use this input to explain normalization step by step.</p></div>
        <img className="page-introduction__illustration" src={schemawiseBirds} width="600" height="600" alt="" aria-hidden="true" decoding="async" fetchPriority="high" />
      </div>
      <section className="schema-editor" aria-label="Schema editor">
        <div className="editor-toolbar">
          <div>
            <p className="eyebrow">Input</p>
            <p className="editor-toolbar__note">Your draft stays in this browser tab.</p>
          </div>
          <button className="button button--quiet" type="button" onClick={requestExample}>Load example</button>
        </div>
        {!navigation?.blocked && confirmExample ? (
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
          <div className="analysis-live-status" role="status" aria-live="polite">{isAnalyzing ? (hasResult ? "Updating analysis…" : "Analyzing schema…") : ""}</div>
          {analyzeHelp ? <p className="analyze-help" id="analyze-help">{analyzeHelp}</p> : null}
          {presentedError ? (
            <div className="analysis-error" id="analysis-error" role="alert">
              <strong>Analysis failed</strong>
              <p>{presentedError.message}</p>
              {presentedError.code ? <span className="technical-error-code">Error code: {presentedError.code}</span> : null}
            </div>
          ) : null}
          <DelayedAsyncHint active={isAnalyzing} requestKey={state.analysis.requestId} />
        </div>
      </section>
      <ClosureTool attributes={state.draft.attributes} issues={issues} state={state.closure} onCalculate={calculateClosure} />
      </> : null}
      {activeView === "analysis" ? <section className="analysis-surface" aria-busy={isAnalyzing}>
        <header className="surface-heading"><div><p className="eyebrow">Understand</p><h1 ref={surfaceHeadingRef} tabIndex={-1}>Analysis</h1><p>{hasResult ? "Understand the analyzed snapshot of this schema." : "Analyze the schema to see candidate keys, normal forms, and violations."}</p></div><Link className="button button--secondary" to={(() => { const params = setWorkspaceView(new URLSearchParams(location.search), "schema"); return `${location.pathname}${params.toString() ? `?${params}` : ""}` })()} onClick={() => { focusSurfaceAfterNavigation.current = true; }}>Edit schema</Link></header>
        <div className="analysis-live-status" role="status" aria-live="polite">
          {isAnalyzing ? (hasResult ? "Updating analysis…" : "Analyzing schema…") : state.analysis.status === "success" ? "Analysis complete." : ""}
        </div>
        {hasResult ? <><AnalysisResults
          result={state.analysis.data!}
          analyzedSnapshot={state.analysis.inputSnapshot!}
          outOfDate={state.analysis.outOfDate}
        /><div className="analysis-transform-link"><Link className="button button--secondary" to={(() => { const params = setWorkspaceView(new URLSearchParams(location.search), "transform"); return `${location.pathname}?${params}`; })()} onClick={() => { focusSurfaceAfterNavigation.current = true; }}>Explore transformations</Link></div></> : isAnalyzing ? (
          <div className="surface-empty-state"><p>Analyzing the schema…</p><DelayedAsyncHint active={isAnalyzing} requestKey={state.analysis.requestId} /></div>
        ) : (
          <div className="surface-empty-state"><p>{project.loadedProjectId ? "No analysis is available for this session. Analyze the schema to continue." : "No analysis is available yet. Go to Schema to analyze it."}</p><Link className="button button--primary" to={(() => { const params = setWorkspaceView(new URLSearchParams(location.search), "schema"); return `${location.pathname}${params.toString() ? `?${params}` : ""}` })()} onClick={() => { focusSurfaceAfterNavigation.current = true; }}>Go to Schema</Link></div>
        )}
      </section> : null}
      {activeView === "transform" ? <TransformSurface
        analysis={hasResult ? state.analysis.data : undefined}
        snapshot={hasResult ? state.analysis.inputSnapshot : undefined}
        outOfDate={state.analysis.outOfDate}
        synthesis={state.synthesis}
        bcnf={state.bcnf}
        preservation={state.dependencyPreservation}
        synthesisError={state.synthesis.status === "error" ? transformationErrorMessage(state.synthesis.error) : undefined}
        bcnfError={state.bcnf.status === "error" ? transformationErrorMessage(state.bcnf.error) : undefined}
        preservationError={state.dependencyPreservation.status === "error" ? transformationErrorMessage(state.dependencyPreservation.error) : undefined}
        analysisHref={(() => { const params = setWorkspaceView(new URLSearchParams(location.search), "analysis"); return `${location.pathname}?${params}`; })()}
        schemaHref={(() => { const params = setWorkspaceView(new URLSearchParams(location.search), "schema"); return `${location.pathname}${params.toString() ? `?${params}` : ""}`; })()}
        onNavigate={() => { focusSurfaceAfterNavigation.current = true; }}
        onGenerateSynthesis={() => void generateSynthesis()}
        onGenerateBcnf={() => void generateBcnf()}
        onCheckPreservation={() => void checkDependencyPreservation()}
        headingRef={surfaceHeadingRef}
      /> : null}
    </div>
  );
}

/** Standalone tests and embedded consumers retain a usable Schema surface. */
export function SchemaWorkspace(props: SchemaWorkspaceProps) {
  const inRouter = useInRouterContext();
  if (inRouter) return <SchemaWorkspaceContent {...props} />;
  return <MemoryRouter><WorkspaceViewProvider><SchemaWorkspaceContent {...props} /></WorkspaceViewProvider></MemoryRouter>;
}
