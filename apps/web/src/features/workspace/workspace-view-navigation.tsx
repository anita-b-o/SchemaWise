import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { parseWorkspaceView, setWorkspaceView, type WorkspaceView } from "./workspace-view";

interface WorkspaceViewNavigation {
  readonly activeView: WorkspaceView;
  goToSchema(): void;
  goToAnalysis(): void;
  goToTransform(): void;
}

const WorkspaceViewContext = createContext<WorkspaceViewNavigation | undefined>(undefined);

export function WorkspaceViewProvider({ children }: { readonly children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = parseWorkspaceView(searchParams);
  const goTo = (view: WorkspaceView) => {
    if (activeView === view) return;
    setSearchParams((current) => setWorkspaceView(current, view));
  };
  const value = useMemo<WorkspaceViewNavigation>(() => ({
    activeView,
    goToSchema: () => goTo("schema"),
    goToAnalysis: () => goTo("analysis"),
    goToTransform: () => goTo("transform"),
  }), [activeView, setSearchParams]);
  return <WorkspaceViewContext.Provider value={value}>{children}</WorkspaceViewContext.Provider>;
}

export function useWorkspaceView(): WorkspaceViewNavigation {
  const value = useContext(WorkspaceViewContext);
  if (!value) throw new Error("WorkspaceViewProvider is required");
  return value;
}
