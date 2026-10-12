import { useMemo } from "react";
import { createBrowserRouter, Link, RouterProvider, useLocation } from "react-router-dom";
import type { AuthApi } from "./api/auth-api";
import type { ProjectApi } from "./api/project-api";
import type { SchemaWiseApi } from "./api/schemawise-api";
import { AuthProvider } from "./features/auth/auth-context";
import { ProjectRoute } from "./features/projects/project-route";
import { ProjectNavigationCoordinator } from "./features/projects/project-navigation";
import { SiteFooter } from "./components/SiteFooter";
import { WorkspaceViewProvider } from "./features/workspace/workspace-view-navigation";
import { DemoWorkspaceHost } from "./features/demo/DemoWorkspaceHost";

function DemoRoute({ api }: { readonly api?: SchemaWiseApi }) {
  return <WorkspaceViewProvider><div className="app-shell"><header className="site-header"><div className="shell site-header__inner"><Link className="wordmark" to="/" aria-label="SchemaWise home">SchemaWise</Link><span className="site-header__context">Relational normalization</span></div></header><main className="shell workspace-page"><DemoWorkspaceHost {...(api ? { api } : {})} /></main><SiteFooter /></div></WorkspaceViewProvider>;
}

function DemoNotFound() {
  return <div className="app-shell"><header className="site-header"><div className="shell site-header__inner"><Link className="wordmark" to="/" aria-label="SchemaWise home">SchemaWise</Link></div></header><main className="shell workspace-page"><h1>Page not found.</h1><p>Check the address and try again.</p></main><SiteFooter /></div>;
}

function ProductBoundary({ authApi, api, projectsApi }: { readonly authApi?: AuthApi; readonly api?: SchemaWiseApi; readonly projectsApi?: ProjectApi }) {
  const { pathname } = useLocation();
  if (pathname.startsWith("/demo/")) return <DemoNotFound />;
  return <AuthProvider {...(authApi ? { api: authApi } : {})}><AppRoutes {...(api ? { api } : {})} {...(projectsApi ? { projectsApi } : {})} /></AuthProvider>;
}

export function AppRoutes({ api, projectsApi }: { readonly api?: SchemaWiseApi; readonly projectsApi?: ProjectApi }) {
  return (
    <WorkspaceViewProvider>
      <ProjectNavigationCoordinator>
        <div className="app-shell">
          <header className="site-header">
            <div className="shell site-header__inner">
              <Link className="wordmark" to="/" aria-label="SchemaWise home">SchemaWise</Link>
              <span className="site-header__context">Relational normalization</span>
              <nav className="site-header__navigation" aria-label="Product">
                <Link className="site-header__link" to="/demo">Try Demo</Link>
              </nav>
            </div>
          </header>
          <main className="shell workspace-page">
            <ProjectRoute {...(api ? { api } : {})} {...(projectsApi ? { projectsApi } : {})} />
          </main>
          <SiteFooter />
        </div>
      </ProjectNavigationCoordinator>
    </WorkspaceViewProvider>
  );
}

export function App({ authApi, api, projectsApi }: { readonly authApi?: AuthApi; readonly api?: SchemaWiseApi; readonly projectsApi?: ProjectApi }) {
  const router = useMemo(() => createBrowserRouter([{
    path: "/demo",
    element: <DemoRoute {...(api ? { api } : {})} />,
  }, {
    path: "*",
    element: <ProductBoundary {...(authApi ? { authApi } : {})} {...(api ? { api } : {})} {...(projectsApi ? { projectsApi } : {})} />,
  }]), [api, authApi, projectsApi]);
  return <RouterProvider router={router} />;
}
