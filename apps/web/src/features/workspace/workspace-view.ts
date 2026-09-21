export type WorkspaceView = "schema" | "analysis" | "transform";

export function parseWorkspaceView(searchParams: URLSearchParams): WorkspaceView {
  const value = searchParams.get("view");
  return value === "analysis" || value === "transform" ? value : "schema";
}

export function setWorkspaceView(searchParams: URLSearchParams, view: WorkspaceView): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (view === "schema") next.delete("view");
  else next.set("view", view);
  return next;
}
