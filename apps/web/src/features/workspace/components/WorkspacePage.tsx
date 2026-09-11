import { useEffect, useRef } from "react";
import type { ProjectApi } from "../../../api/project-api";
import type { SchemaWiseApi } from "../../../api/schemawise-api";
import type { ProjectDto } from "../../../api/schemawise-contracts";
import { SchemaWorkspace } from "./SchemaWorkspace";

export function WorkspacePage({ initialProject, focusAfterHydration = false, api, projectsApi }: { readonly initialProject?: ProjectDto; readonly focusAfterHydration?: boolean; readonly api?: SchemaWiseApi; readonly projectsApi?: ProjectApi }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hydrationFocusMoved = useRef(false);

  useEffect(() => {
    if (!initialProject) document.title = "SchemaWise";
    if (focusAfterHydration && !hydrationFocusMoved.current) {
      hydrationFocusMoved.current = true;
      headingRef.current?.focus();
    }
  }, [focusAfterHydration, initialProject]);

  return (
    <>
      <div className="page-introduction">
        <p className="eyebrow">Schema workspace</p>
        <h1 ref={headingRef} tabIndex={focusAfterHydration ? -1 : undefined}>Define a relation and its dependencies.</h1>
        <p>Model the facts your relation stores. SchemaWise will use this input to explain normalization step by step.</p>
      </div>
      <SchemaWorkspace {...(initialProject ? { initialProject } : {})} {...(api ? { api } : {})} {...(projectsApi ? { projectsApi } : {})} />
    </>
  );
}
