import { useEffect, useRef, useState } from "react";
import { MemoryRouter, useInRouterContext, useLocation } from "react-router-dom";
import type { SchemaWiseApi } from "../../../api/schemawise-api";
import { projectApi as defaultProjectApi, type ProjectApi } from "../../../api/project-api";
import { HttpApiError } from "../../../api/http-api";
import type { ProjectDto, ProjectSummaryDto } from "../../../api/schemawise-contracts";
import { AuthPanel } from "../../auth/AuthPanel";
import { useAuth } from "../../auth/auth-context";
import { ProjectListPanel } from "../../projects/ProjectListPanel";
import { ProjectNavigationPrompt, useProjectNavigation } from "../../projects/project-navigation";
import { useProjectRouteCoordination } from "../../projects/project-route-context";
import { draftToPersistedSchema, initialProjectSession, isProjectDirty, isRouteLoadedProjectCoherent, persistedSchemaToDraft, sessionFromProject, type ProjectSession } from "../../projects/project-session";
import { useSharedWorkspaceCore } from "../shared-workspace-core";
import { WorkspaceViewProvider, useWorkspaceView } from "../workspace-view-navigation";
import { WorkspaceNavigation } from "./WorkspaceNavigation";
import { WorkspaceSurfaces } from "./WorkspaceSurfaces";

interface SchemaWorkspaceProps {
  readonly api?: SchemaWiseApi;
  readonly projectsApi?: ProjectApi;
  readonly initialProject?: ProjectDto;
  readonly focusAfterHydration?: boolean;
}

function focusFirstIssue(field: string) {
  const selector = field === "relationName" ? "#relation-name" : field.startsWith("attribute:") ? `#attribute-${CSS.escape(field.slice("attribute:".length))}` : field === "attributes" ? ".add-button" : "#dependencies-heading";
  document.querySelector<HTMLElement>(selector)?.focus();
}

function SchemaWorkspaceContent({ api, projectsApi = defaultProjectApi, initialProject, focusAfterHydration = false }: SchemaWorkspaceProps) {
  const auth = useAuth();
  const navigation = useProjectNavigation();
  const route = useProjectRouteCoordination();
  const { activeView, goToAnalysis } = useWorkspaceView();
  const location = useLocation();
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
  const core = useSharedWorkspaceCore({
    ...(api ? { api } : {}),
    ...(initialProject ? { initialDraft: persistedSchemaToDraft(initialProject.schema) } : {}),
    onAnalyzeSuccess: () => { focusSurfaceAfterNavigation.current = true; goToAnalysis(); },
    onInvalidAnalysis: (issue) => focusFirstIssue(issue.field),
  });
  const { state, dispatch } = core;
  const isAnalyzing = state.analysis.status === "loading";
  const hasResult = state.analysis.data !== undefined && state.analysis.inputSnapshot !== undefined;
  const isPristine = state.draft.relationName === "" && state.draft.attributes.length === 0 && state.draft.functionalDependencies.length === 0;
  const dirty = isProjectDirty(project, state.draft);
  const rootTransitionKeyRef = useRef(navigation?.rootTransitionKey);
  const appliedProjectRef = useRef(initialProject);
  const savedAdoptionRef = useRef<{ id: string; revision: number } | undefined>(undefined);
  const handledRouteErrorRef = useRef<string | undefined>(undefined);

  function requestExample() {
    if (isPristine) dispatch({ type: "loadExample" });
    else setConfirmExample(true);
  }

  function loadExample() {
    dispatch({ type: "loadExample" });
    setConfirmExample(false);
  }

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
    core.replaceDraft(persistedSchemaToDraft(initialProject.schema));
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
    core.resetWorkspace();
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
      <WorkspaceSurfaces core={core} activeView={activeView} navigationBlocked={navigation?.blocked ?? false} confirmExample={confirmExample} onRequestExample={requestExample} onCancelExample={() => setConfirmExample(false)} onLoadExample={loadExample} surfaceHeadingRef={surfaceHeadingRef} onNavigate={() => { focusSurfaceAfterNavigation.current = true; }} emptyAnalysisMessage={project.loadedProjectId ? "No analysis is available for this session. Analyze the schema to continue." : "No analysis is available yet. Go to Schema to analyze it."} />
    </div>
  );
}

/** Standalone tests and embedded consumers retain a usable Schema surface. */
export function ProjectWorkspaceHost(props: SchemaWorkspaceProps) {
  const inRouter = useInRouterContext();
  if (inRouter) return <SchemaWorkspaceContent {...props} />;
  return <MemoryRouter><WorkspaceViewProvider><SchemaWorkspaceContent {...props} /></WorkspaceViewProvider></MemoryRouter>;
}

/** @deprecated Prefer ProjectWorkspaceHost for the persistent resource host. */
export const SchemaWorkspace = ProjectWorkspaceHost;
