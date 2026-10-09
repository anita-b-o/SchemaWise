import type { ProjectApi } from "../../../api/project-api";
import type { SchemaWiseApi } from "../../../api/schemawise-api";
import type { ProjectDto } from "../../../api/schemawise-contracts";
import { ProjectWorkspaceHost } from "./SchemaWorkspace";

export function WorkspacePage({ initialProject, focusAfterHydration = false, api, projectsApi }: { readonly initialProject?: ProjectDto; readonly focusAfterHydration?: boolean; readonly api?: SchemaWiseApi; readonly projectsApi?: ProjectApi }) {
  return <ProjectWorkspaceHost focusAfterHydration={focusAfterHydration} {...(initialProject ? { initialProject } : {})} {...(api ? { api } : {})} {...(projectsApi ? { projectsApi } : {})} />;

}
