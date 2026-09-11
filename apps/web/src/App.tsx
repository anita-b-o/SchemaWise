import { useMemo } from "react";
import { createBrowserRouter, Link, RouterProvider } from "react-router-dom";
import type { AuthApi } from "./api/auth-api";
import type { ProjectApi } from "./api/project-api";
import type { SchemaWiseApi } from "./api/schemawise-api";
import { AuthProvider } from "./features/auth/auth-context";
import { ProjectRoute } from "./features/projects/project-route";
import { ProjectNavigationCoordinator } from "./features/projects/project-navigation";

export function AppRoutes({ api, projectsApi }: { readonly api?: SchemaWiseApi; readonly projectsApi?: ProjectApi }) {
  return (
    <ProjectNavigationCoordinator>
      <header className="site-header">
        <div className="shell site-header__inner">
          <Link className="wordmark" to="/" aria-label="SchemaWise home">SchemaWise</Link>
          <span className="site-header__context">Relational normalization</span>
        </div>
      </header>
      <main className="shell workspace-page">
        <ProjectRoute {...(api ? { api } : {})} {...(projectsApi ? { projectsApi } : {})} />
      </main>
    </ProjectNavigationCoordinator>
  );
}

export function App({ authApi, api, projectsApi }: { readonly authApi?: AuthApi; readonly api?: SchemaWiseApi; readonly projectsApi?: ProjectApi }) {
  const router = useMemo(() => createBrowserRouter([{
    path: "*",
    element: <AuthProvider {...(authApi ? { api: authApi } : {})}><AppRoutes {...(api ? { api } : {})} {...(projectsApi ? { projectsApi } : {})} /></AuthProvider>,
  }]), [api, authApi, projectsApi]);
  return <RouterProvider router={router} />;
}
