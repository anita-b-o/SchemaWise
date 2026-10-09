import { matchPath } from "react-router-dom";

export function workspaceResourceIdentity(pathname: string): string {
  if (pathname === "/") return "ROOT WORKSPACE";
  if (pathname === "/demo") return "DEMO WORKSPACE";
  const projectId = matchPath("/projects/:projectId", pathname)?.params.projectId;
  return projectId ? `PROJECT:${projectId.toLowerCase()}` : `PATH:${pathname}`;
}
