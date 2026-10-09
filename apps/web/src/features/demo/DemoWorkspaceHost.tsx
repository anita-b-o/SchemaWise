import { useEffect, useRef } from "react";
import { Link, useBlocker, useLocation } from "react-router-dom";
import type { SchemaWiseApi } from "../../api/schemawise-api";
import { workspaceResourceIdentity } from "../projects/workspace-resource-identity";
import { useSharedWorkspaceCore } from "../workspace/shared-workspace-core";
import { useWorkspaceView } from "../workspace/workspace-view-navigation";
import { WorkspaceNavigation } from "../workspace/components/WorkspaceNavigation";
import { WorkspaceSurfaces } from "../workspace/components/WorkspaceSurfaces";

/** The empty draft is this tranche's temporary dirty baseline. */
export function DemoWorkspaceHost({ api }: { readonly api?: SchemaWiseApi }) {
  const { activeView, goToAnalysis } = useWorkspaceView();
  const location = useLocation();
  const surfaceHeadingRef = useRef<HTMLHeadingElement>(null);
  const promptHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterNavigation = useRef(false);
  const exitFocus = useRef<HTMLElement | null>(null);
  const proceeding = useRef(false);
  const core = useSharedWorkspaceCore({
    ...(api ? { api } : {}),
    onAnalyzeSuccess: () => { focusAfterNavigation.current = true; goToAnalysis(); },
    onInvalidAnalysis: (issue) => {
      const selector = issue.field === "relationName" ? "#relation-name" : issue.field.startsWith("attribute:") ? `#attribute-${CSS.escape(issue.field.slice("attribute:".length))}` : issue.field === "attributes" ? ".add-button" : "#dependencies-heading";
      document.querySelector<HTMLElement>(selector)?.focus();
    },
  });
  const { draft } = core.state;
  const dirty = draft.relationName !== "" || draft.attributes.length !== 0 || draft.functionalDependencies.length !== 0;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && workspaceResourceIdentity(currentLocation.pathname) !== workspaceResourceIdentity(nextLocation.pathname));

  useEffect(() => { document.title = "SchemaWise Demo — SchemaWise"; }, []);
  useEffect(() => { if (blocker.state === "blocked") promptHeadingRef.current?.focus(); }, [blocker.state]);
  useEffect(() => {
    if (!focusAfterNavigation.current) return;
    focusAfterNavigation.current = false;
    surfaceHeadingRef.current?.focus();
  }, [activeView]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function stay() {
    blocker.reset?.();
    proceeding.current = false;
    setTimeout(() => exitFocus.current?.focus());
  }

  function discardAndContinue() {
    if (blocker.state !== "blocked" || proceeding.current) return;
    proceeding.current = true;
    blocker.proceed();
  }

  const hasResult = core.state.analysis.data !== undefined && core.state.analysis.inputSnapshot !== undefined;
  return <div className="workspace-shell" data-resource-identity="DEMO WORKSPACE" data-demo-path={location.pathname}>
    <header className="workspace-context">
      <div className="workspace-context__identity"><p className="eyebrow">Demo</p><p className="workspace-context__name">Temporary workspace</p><p className="workspace-context__meta">Demo mode — Your work is temporary and won't be saved.</p></div>
      <WorkspaceNavigation activeView={activeView} onNavigate={(view) => { if (view !== activeView) focusAfterNavigation.current = true; }} />
      <span className="save-state" aria-live="polite">{dirty ? "Local changes" : "Temporary"}{activeView !== "schema" && hasResult ? <span className={core.state.analysis.outOfDate ? "analysis-currency--stale" : "analysis-currency"}>{core.state.analysis.outOfDate ? "Out of date" : "Current"}</span> : null}</span>
    </header>
    <div className="demo-exit"><Link className="button button--quiet" to="/" onClick={(event) => { exitFocus.current = event.currentTarget; }}>Exit demo</Link></div>
    {blocker.state === "blocked" ? <section className="inline-confirmation navigation-confirmation" role="alert" aria-labelledby="demo-leave-heading"><div><h2 ref={promptHeadingRef} tabIndex={-1} id="demo-leave-heading">Discard Demo changes?</h2><p>Leaving Demo will discard your local changes.</p></div><div className="button-row"><button className="button button--secondary" type="button" onClick={stay}>Stay</button><button className="button button--danger-solid" type="button" onClick={discardAndContinue}>Discard and continue</button></div></section> : null}
    <WorkspaceSurfaces core={core} activeView={activeView} navigationBlocked={blocker.state === "blocked"} confirmExample={false} surfaceHeadingRef={surfaceHeadingRef} onNavigate={() => { focusAfterNavigation.current = true; }} emptyAnalysisMessage="No analysis is available yet. Go to Schema to analyze it." />
  </div>;
}
