import { Link, useLocation } from "react-router-dom";
import { setWorkspaceView, type WorkspaceView } from "../workspace-view";

export function WorkspaceNavigation({ activeView, onNavigate }: { readonly activeView: WorkspaceView; readonly onNavigate: (view: WorkspaceView) => void }) {
  const location = useLocation();
  const href = (view: WorkspaceView) => {
    const search = setWorkspaceView(new URLSearchParams(location.search), view).toString();
    return `${location.pathname}${search ? `?${search}` : ""}`;
  };
  return <nav className="workspace-navigation" aria-label="Workspace">
    {(["schema", "analysis", "transform"] as const).map((view) => <Link key={view} className="workspace-navigation__link" to={href(view)} aria-current={activeView === view ? "page" : undefined} onClick={() => onNavigate(view)}>{view === "schema" ? "Schema" : view === "analysis" ? "Analysis" : "Transform"}</Link>)}
  </nav>;
}
