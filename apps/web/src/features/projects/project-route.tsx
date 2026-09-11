import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { HttpApiError } from "../../api/http-api";
import { projectApi as defaultProjectApi, type ProjectApi } from "../../api/project-api";
import type { SchemaWiseApi } from "../../api/schemawise-api";
import type { ProjectDto } from "../../api/schemawise-contracts";
import { AuthPanel } from "../auth/AuthPanel";
import { useAuth } from "../auth/auth-context";
import { WorkspacePage } from "../workspace/components/WorkspacePage";
import { useProjectNavigation } from "./project-navigation";
import { ProjectRouteProvider, type ProjectRouteCoordination, type RouteHydrationReason, type VisibleProjectSession } from "./project-route-context";
import { consumeProjectAdoption, peekProjectAdoption } from "./project-route-adoption";
import { isCanonicalUuidV4 } from "./project-route-utils";
import { isRouteLoadedProjectCoherent, shouldAutoRehydrateAfterAuth } from "./project-session";

type ProjectHydration =
  | { readonly status: "idle" | "waiting-for-auth" }
  | { readonly status: "loading"; readonly projectId: string; readonly requestId: string; readonly reason: RouteHydrationReason }
  | { readonly status: "loaded"; readonly projectId: string; readonly project: ProjectDto; readonly reason: RouteHydrationReason }
  | { readonly status: "not-found" | "error"; readonly projectId: string; readonly reason: RouteHydrationReason };

function RouteState({ heading, message, status = false, onRetry }: { readonly heading?: string; readonly message: string; readonly status?: boolean; readonly onRetry?: () => void }) {
  return <section className="route-state" {...(heading ? { "aria-labelledby": "route-state-heading" } : {})}>
    {heading ? <h1 id="route-state-heading">{heading}</h1> : null}
    <p {...(status ? { role: "status" as const } : {})}>{message}</p>
    {onRetry ? <button className="button button--primary" type="button" onClick={onRetry}>Retry</button> : null}
  </section>;
}

export function ProjectRoute({ projectsApi = defaultProjectApi, api }: { readonly projectsApi?: ProjectApi; readonly api?: SchemaWiseApi }) {
  const location = useLocation();
  const match = matchPath("/projects/:projectId", location.pathname);
  const rawProjectId = match?.params.projectId;
  const valid = rawProjectId === undefined || isCanonicalUuidV4(rawProjectId);
  const routeProjectId = rawProjectId && valid ? rawProjectId.toLowerCase() : rawProjectId;
  const isRoot = location.pathname === "/";
  const auth = useAuth();
  const navigation = useProjectNavigation();
  const [hydration, setHydration] = useState<ProjectHydration>({ status: "idle" });
  const [visible, setVisible] = useState<VisibleProjectSession>({ dirty: false });
  const [request, setRequest] = useState<{ readonly version: number; readonly reason: RouteHydrationReason }>({ version: 0, reason: "initial" });
  const [authOpen, setAuthOpen] = useState(false);
  const [dirtyReconnectPreserved, setDirtyReconnectPreserved] = useState(false);
  const activeRef = useRef<{ projectId: string; requestId: string; controller: AbortController } | undefined>(undefined);
  const routeIdRef = useRef(routeProjectId);
  const previousAuth = useRef(auth.status);
  const lastLoadedProjectRef = useRef<ProjectDto | undefined>(undefined);
  routeIdRef.current = routeProjectId;

  const adoptionToken = typeof location.state === "object" && location.state !== null && "adoptionToken" in location.state && typeof location.state.adoptionToken === "string" ? location.state.adoptionToken : undefined;
  const adoptedProject = routeProjectId ? peekProjectAdoption(adoptionToken, routeProjectId) : undefined;
  const matchingVisible = isRouteLoadedProjectCoherent(routeProjectId, visible.loadedProjectId);

  const requestHydration = useCallback((reason: RouteHydrationReason) => setRequest((current) => ({ version: current.version + 1, reason })), []);

  useEffect(() => {
    const becameAuthenticated = previousAuth.current !== "authenticated" && auth.status === "authenticated";
    previousAuth.current = auth.status;
    if (!becameAuthenticated || !routeProjectId) return;
    if (shouldAutoRehydrateAfterAuth({ routeProjectId, ...(visible.loadedProjectId ? { loadedProjectId: visible.loadedProjectId } : {}), dirty: visible.dirty })) {
      setDirtyReconnectPreserved(false);
      requestHydration("reconnect");
    } else if (matchingVisible && visible.dirty) setDirtyReconnectPreserved(true);
  }, [auth.status, matchingVisible, requestHydration, routeProjectId, visible.dirty, visible.loadedProjectId]);

  useEffect(() => {
    if (isRoot || !routeProjectId || !valid) {
      activeRef.current?.controller.abort();
      activeRef.current = undefined;
      setHydration((current) => current.status === "idle" ? current : { status: "idle" });
      return;
    }
    if (adoptedProject) {
      activeRef.current?.controller.abort();
      activeRef.current = undefined;
      consumeProjectAdoption(adoptionToken);
      lastLoadedProjectRef.current = adoptedProject;
      setHydration({ status: "loaded", projectId: routeProjectId, project: adoptedProject, reason: "initial" });
      return;
    }
    if (auth.status !== "authenticated") {
      activeRef.current?.controller.abort();
      activeRef.current = undefined;
      if (!matchingVisible) setHydration((current) => current.status === "waiting-for-auth" ? current : { status: "waiting-for-auth" });
      return;
    }

    const explicitlyRequested = request.version > 0 && request.reason !== "initial";
    const alreadyLoaded = hydration.status === "loaded" && hydration.projectId === routeProjectId;
    if (activeRef.current?.projectId === routeProjectId && !explicitlyRequested) return;
    if (matchingVisible && !explicitlyRequested) return;
    if (!explicitlyRequested && alreadyLoaded) return;

    activeRef.current?.controller.abort();
    const controller = new AbortController();
    const requestId = crypto.randomUUID();
    const reason = explicitlyRequested ? request.reason : "initial";
    activeRef.current = { projectId: routeProjectId, requestId, controller };
    setHydration({ status: "loading", projectId: routeProjectId, requestId, reason });
    if (explicitlyRequested) setRequest({ version: 0, reason: "initial" });

    void projectsApi.getProject(routeProjectId, controller.signal).then((project) => {
      if (controller.signal.aborted || activeRef.current?.requestId !== requestId || routeIdRef.current !== routeProjectId) return;
      activeRef.current = undefined;
      if (project.id.toLowerCase() !== routeProjectId) { setHydration({ status: "error", projectId: routeProjectId, reason }); return; }
      setDirtyReconnectPreserved(false);
      lastLoadedProjectRef.current = project;
      setHydration({ status: "loaded", projectId: routeProjectId, project, reason });
    }).catch((error: unknown) => {
      if (controller.signal.aborted || activeRef.current?.requestId !== requestId || routeIdRef.current !== routeProjectId) return;
      activeRef.current = undefined;
      if (error instanceof HttpApiError && error.status === 401) { auth.setUnauthenticated(); return; }
      if (error instanceof HttpApiError && error.status === 404) {
        if (matchingVisible) navigation?.detachCurrentProject("The saved project is no longer available. Your changes are still here and can be saved as a new project.");
        else setHydration({ status: "not-found", projectId: routeProjectId, reason });
        return;
      }
      setHydration({ status: "error", projectId: routeProjectId, reason });
    });

  }, [adoptedProject, adoptionToken, auth.setUnauthenticated, auth.status, isRoot, matchingVisible, navigation, projectsApi, request, routeProjectId, valid]);

  useEffect(() => () => activeRef.current?.controller.abort(), []);
  useEffect(() => {
    if (hydration.status === "loaded" && hydration.projectId === routeProjectId) document.title = `${hydration.project.name} — SchemaWise`;
    else if (!matchingVisible) document.title = "SchemaWise";
  }, [hydration, matchingVisible, routeProjectId]);

  const coordination = useMemo<ProjectRouteCoordination>(() => ({
    ...(!isRoot && routeProjectId ? { routeProjectId } : {}),
    hydrationStatus: hydration.status,
    ...(hydration.status === "loading" || hydration.status === "loaded" || hydration.status === "error" || hydration.status === "not-found" ? { hydrationReason: hydration.reason } : {}),
    dirtyReconnectPreserved,
    reportVisibleSession: setVisible,
    rehydrateCurrentRoute: () => requestHydration("reload"),
  }), [dirtyReconnectPreserved, hydration, isRoot, requestHydration, routeProjectId]);

  let content;
  if (!isRoot && !match) content = <RouteState heading="Page not found." message="Check the address and try again." />;
  else if (!valid) content = <RouteState heading="Invalid project link." message="Check the address and try again." />;
  else if (isRoot) content = <WorkspacePage {...(api ? { api } : {})} projectsApi={projectsApi} />;
  else if (matchingVisible) content = <WorkspacePage {...(hydration.status === "loaded" && hydration.projectId === routeProjectId ? { initialProject: hydration.project } : lastLoadedProjectRef.current ? { initialProject: lastLoadedProjectRef.current } : {})} {...(api ? { api } : {})} projectsApi={projectsApi} />;
  else if (auth.status === "unknown") content = <RouteState message="Checking your session…" status />;
  else if (auth.status === "unauthenticated") content = <><RouteState heading="Sign in to open this project." message="This project requires an authenticated session." /><button className="button button--primary" type="button" onClick={() => setAuthOpen(true)}>Sign in</button>{authOpen ? <AuthPanel onClose={() => setAuthOpen(false)} /> : null}</>;
  else if (hydration.status === "loaded" && hydration.projectId === routeProjectId) content = <WorkspacePage initialProject={hydration.project} focusAfterHydration {...(api ? { api } : {})} projectsApi={projectsApi} />;
  else if (hydration.status === "not-found" && hydration.projectId === routeProjectId) content = <RouteState heading="Project not found or unavailable." message="The project cannot be opened from this account." />;
  else if (hydration.status === "error" && hydration.projectId === routeProjectId) content = <RouteState heading="Could not load project." message="Your workspace was not changed." onRetry={() => requestHydration("retry")} />;
  else content = <RouteState message="Opening your project…" status />;

  return <ProjectRouteProvider value={coordination}>{content}</ProjectRouteProvider>;
}
