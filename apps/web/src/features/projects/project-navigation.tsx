import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useBlocker, useLocation, useNavigate } from "react-router-dom";
import type { ProjectDto } from "../../api/schemawise-contracts";
import { recordProjectAdoption } from "./project-route-adoption";

interface ProjectNavigationValue {
  readonly blocked: boolean;
  readonly locationKey: string;
  readonly pathname: string;
  readonly promptHeading: RefObject<HTMLHeadingElement | null>;
  setDirty(dirty: boolean): void;
  navigateToProject(projectId: string, source?: HTMLElement | null): void;
  navigateToRoot(source?: HTMLElement | null): void;
  adoptCreatedProject(project: ProjectDto): void;
  detachCurrentProject(message: string): void;
  consumeDetachIntent(): { readonly message: string } | undefined;
  updateCurrentProjectTitle(name: string): void;
  stay(): void;
  discardAndContinue(): void;
}

const ProjectNavigationContext = createContext<ProjectNavigationValue | undefined>(undefined);

export function useProjectNavigation(): ProjectNavigationValue | undefined {
  return useContext(ProjectNavigationContext);
}

export function ProjectNavigationCoordinator({ children }: { readonly children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [dirty, setDirty] = useState(false);
  const requestedNavigation = useRef<{ pathname: string; force: boolean } | undefined>(undefined);
  const bypassPathname = useRef<string | undefined>(undefined);
  const returnFocus = useRef<HTMLElement | null>(null);
  const promptHeading = useRef<HTMLHeadingElement>(null);
  const proceeding = useRef(false);
  const detachIntent = useRef<{ message: string } | undefined>(undefined);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!dirty || bypassPathname.current === nextLocation.pathname) return false;
    return currentLocation.pathname !== nextLocation.pathname || requestedNavigation.current?.force === true;
  });

  useEffect(() => {
    if (blocker.state === "blocked") promptHeading.current?.focus();
  }, [blocker.state]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    requestedNavigation.current = undefined;
    bypassPathname.current = undefined;
    proceeding.current = false;
    setDirty(false);
  }, [location.key]);

  const requestNavigation = useCallback((pathname: string, source?: HTMLElement | null) => {
    returnFocus.current = source ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    requestedNavigation.current = { pathname, force: pathname === location.pathname };
    navigate(pathname);
  }, [location.pathname, navigate]);

  const adoptCreatedProject = useCallback((project: ProjectDto) => {
    const pathname = `/projects/${project.id}`;
    const adoptionToken = recordProjectAdoption(project);
    bypassPathname.current = pathname;
    navigate(pathname, { replace: true, state: { adoptionToken } });
  }, [navigate]);

  const detachCurrentProject = useCallback((message: string) => {
    detachIntent.current = { message };
    bypassPathname.current = "/";
    navigate("/", { replace: true });
  }, [navigate]);

  const value = useMemo<ProjectNavigationValue>(() => ({
    blocked: blocker.state === "blocked",
    locationKey: location.key,
    pathname: location.pathname,
    promptHeading,
    setDirty,
    navigateToProject: (projectId, source) => requestNavigation(`/projects/${projectId}`, source),
    navigateToRoot: (source) => requestNavigation("/", source),
    adoptCreatedProject,
    detachCurrentProject,
    consumeDetachIntent: () => {
      const intent = detachIntent.current;
      detachIntent.current = undefined;
      return intent;
    },
    updateCurrentProjectTitle: (name) => { document.title = `${name} — SchemaWise`; },
    stay,
    discardAndContinue,
  }), [adoptCreatedProject, blocker.state, detachCurrentProject, location.key, location.pathname, requestNavigation]);

  function stay() {
    blocker.reset?.();
    requestedNavigation.current = undefined;
    proceeding.current = false;
    setTimeout(() => returnFocus.current?.focus());
  }

  function discardAndContinue() {
    if (blocker.state !== "blocked" || proceeding.current) return;
    proceeding.current = true;
    setDirty(false);
    blocker.proceed();
  }

  return (
    <ProjectNavigationContext.Provider value={value}>
      {children}
    </ProjectNavigationContext.Provider>
  );
}

export function ProjectNavigationPrompt() {
  const navigation = useProjectNavigation();
  if (!navigation?.blocked) return null;
  return (
    <section className="inline-confirmation navigation-confirmation" role="alert" aria-labelledby="unsaved-navigation-heading">
      <div>
        <h2 ref={navigation.promptHeading} tabIndex={-1} id="unsaved-navigation-heading">Unsaved changes</h2>
        <p>Leaving this project will discard your unsaved changes.</p>
      </div>
      <div className="button-row">
        <button className="button button--secondary" type="button" onClick={navigation.stay}>Stay</button>
        <button className="button button--danger-solid" type="button" onClick={navigation.discardAndContinue}>Discard and continue</button>
      </div>
    </section>
  );
}
