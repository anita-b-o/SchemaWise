import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { HttpApiError } from "../../api/http-api";
import { projectApi as defaultProjectApi, type ProjectApi } from "../../api/project-api";
import type { SchemaWiseApi } from "../../api/schemawise-api";
import type { ProjectDto } from "../../api/schemawise-contracts";
import { AuthPanel } from "../auth/AuthPanel";
import { useAuth } from "../auth/auth-context";
import { WorkspacePage } from "../workspace/components/WorkspacePage";
import { isCanonicalUuidV4 } from "./project-route-utils";

export type ProjectHydration =
  | { readonly status: "loading"; readonly projectId: string; readonly requestId: string }
  | { readonly status: "loaded"; readonly projectId: string; readonly project: ProjectDto }
  | { readonly status: "not-found"; readonly projectId: string }
  | { readonly status: "error"; readonly projectId: string };

function RouteState({ heading, message, status = false, onRetry }: { readonly heading?: string; readonly message: string; readonly status?: boolean; readonly onRetry?: () => void }) {
  return (
    <section className="route-state" {...(heading ? { "aria-labelledby": "route-state-heading" } : {})}>
      {heading ? <h1 id="route-state-heading">{heading}</h1> : null}
      <p {...(status ? { role: "status" as const } : {})}>{message}</p>
      {onRetry ? <button className="button button--primary" type="button" onClick={onRetry}>Retry</button> : null}
    </section>
  );
}

export function ProjectRoute({ projectsApi = defaultProjectApi, api }: { readonly projectsApi?: ProjectApi; readonly api?: SchemaWiseApi }) {
  const { projectId = "" } = useParams();
  const auth = useAuth();
  const [hydration, setHydration] = useState<ProjectHydration>();
  const [retryVersion, setRetryVersion] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const valid = isCanonicalUuidV4(projectId);
  const routeProjectId = valid ? projectId.toLowerCase() : projectId;
  const routeIdRef = useRef(routeProjectId);
  const activeRef = useRef<{ projectId: string; requestId: string; retryVersion: number; controller: AbortController } | undefined>(undefined);
  const effectGeneration = useRef(0);
  routeIdRef.current = routeProjectId;

  const loaded = hydration?.status === "loaded" && hydration.projectId === routeProjectId ? hydration : undefined;

  useEffect(() => {
    document.title = loaded ? `${loaded.project.name} — SchemaWise` : "SchemaWise";
  }, [loaded]);

  useEffect(() => {
    const generation = ++effectGeneration.current;
    if (!valid || auth.status !== "authenticated") {
      activeRef.current?.controller.abort();
      activeRef.current = undefined;
      return;
    }

    let active = activeRef.current;
    if (!active || active.projectId !== routeProjectId || active.retryVersion !== retryVersion) {
      active?.controller.abort();
      const controller = new AbortController();
      const requestId = crypto.randomUUID();
      active = { projectId: routeProjectId, requestId, retryVersion, controller };
      activeRef.current = active;
      setHydration({ status: "loading", projectId: routeProjectId, requestId });

      void projectsApi.getProject(routeProjectId, controller.signal).then((project) => {
        if (controller.signal.aborted || activeRef.current?.requestId !== requestId || routeIdRef.current !== routeProjectId) return;
        if (project.id.toLowerCase() !== routeProjectId) {
          setHydration({ status: "error", projectId: routeProjectId });
          return;
        }
        setHydration({ status: "loaded", projectId: routeProjectId, project });
      }).catch((error: unknown) => {
        if (controller.signal.aborted || activeRef.current?.requestId !== requestId || routeIdRef.current !== routeProjectId) return;
        if (error instanceof HttpApiError && error.status === 401) {
          auth.setUnauthenticated();
          return;
        }
        setHydration(error instanceof HttpApiError && error.status === 404
          ? { status: "not-found", projectId: routeProjectId }
          : { status: "error", projectId: routeProjectId });
      });
    }

    const controller = active.controller;
    return () => {
      queueMicrotask(() => {
        if (effectGeneration.current === generation && activeRef.current?.controller === controller) {
          controller.abort();
          activeRef.current = undefined;
        }
      });
    };
  }, [auth.setUnauthenticated, auth.status, projectsApi, retryVersion, routeProjectId, valid]);

  if (!valid) return <RouteState heading="Invalid project link." message="Check the address and try again." />;
  if (auth.status === "unknown") return <RouteState message="Checking your session…" status />;
  if (auth.status === "unauthenticated") {
    return (
      <>
        <RouteState heading="Sign in to open this project." message="This project requires an authenticated session." />
        {authOpen ? <AuthPanel onClose={() => setAuthOpen(false)} /> : <button className="button button--primary" type="button" onClick={() => setAuthOpen(true)}>Sign in</button>}
      </>
    );
  }
  if (loaded) return <WorkspacePage key={loaded.projectId} initialProject={loaded.project} projectsApi={projectsApi} {...(api ? { api } : {})} focusAfterHydration />;
  if (hydration?.status === "not-found" && hydration.projectId === routeProjectId) return <RouteState heading="Project not found or unavailable." message="The project cannot be opened from this account." />;
  if (hydration?.status === "error" && hydration.projectId === routeProjectId) return <RouteState heading="Could not load project." message="Your workspace was not changed." onRetry={() => setRetryVersion((value) => value + 1)} />;
  return <RouteState message="Opening your project…" status />;
}
