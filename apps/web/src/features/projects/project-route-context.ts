import { createContext, useContext } from "react";

export type RouteHydrationReason = "initial" | "retry" | "reconnect" | "reload";

export interface VisibleProjectSession {
  readonly loadedProjectId?: string;
  readonly dirty: boolean;
}

export interface ProjectRouteCoordination {
  readonly routeProjectId?: string;
  readonly hydrationStatus: "idle" | "waiting-for-auth" | "loading" | "loaded" | "error" | "not-found";
  readonly hydrationReason?: RouteHydrationReason;
  readonly dirtyReconnectPreserved: boolean;
  reportVisibleSession(session: VisibleProjectSession): void;
  rehydrateCurrentRoute(): void;
}

const ProjectRouteContext = createContext<ProjectRouteCoordination | undefined>(undefined);
export const ProjectRouteProvider = ProjectRouteContext.Provider;
export function useProjectRouteCoordination(): ProjectRouteCoordination | undefined { return useContext(ProjectRouteContext); }
