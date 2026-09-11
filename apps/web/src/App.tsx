import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { AuthApi } from "./api/auth-api";
import type { ProjectApi } from "./api/project-api";
import type { SchemaWiseApi } from "./api/schemawise-api";
import { AuthProvider } from "./features/auth/auth-context";
import { ProjectRoute } from "./features/projects/project-route";
import { WorkspacePage } from "./features/workspace/components/WorkspacePage";

export function AppRoutes({ api, projectsApi }: { readonly api?: SchemaWiseApi; readonly projectsApi?: ProjectApi }) {
  return (
    <>
      <header className="site-header">
        <div className="shell site-header__inner">
          <a className="wordmark" href="/" aria-label="SchemaWise home">SchemaWise</a>
          <span className="site-header__context">Relational normalization</span>
        </div>
      </header>
      <main className="shell workspace-page">
        <Routes>
          <Route path="/" element={<WorkspacePage {...(api ? { api } : {})} {...(projectsApi ? { projectsApi } : {})} />} />
          <Route path="/projects/:projectId" element={<ProjectRoute {...(api ? { api } : {})} {...(projectsApi ? { projectsApi } : {})} />} />
        </Routes>
      </main>
    </>
  );
}

export function App({ authApi, api, projectsApi }: { readonly authApi?: AuthApi; readonly api?: SchemaWiseApi; readonly projectsApi?: ProjectApi }) {
  return <BrowserRouter><AuthProvider {...(authApi ? { api: authApi } : {})}><AppRoutes {...(api ? { api } : {})} {...(projectsApi ? { projectsApi } : {})} /></AuthProvider></BrowserRouter>;
}
