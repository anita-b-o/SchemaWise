import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useLocation } from "react-router-dom";
import type { SchemaWiseApi } from "../../api/schemawise-api";
import { workspaceResourceIdentity } from "../projects/workspace-resource-identity";
import { useSharedWorkspaceCore } from "../workspace/shared-workspace-core";
import { useWorkspaceView } from "../workspace/workspace-view-navigation";
import { WorkspaceNavigation } from "../workspace/components/WorkspaceNavigation";
import { WorkspaceSurfaces } from "../workspace/components/WorkspaceSurfaces";
import { demoFixtures, draftForDemoSelection, sameDemoDraft, type DemoSelection } from "./demo-fixtures";

export function DemoWorkspaceHost({ api }: { readonly api?: SchemaWiseApi }) {
  const { activeView, goToAnalysis, goToSchema } = useWorkspaceView();
  const location = useLocation();
  const surfaceHeadingRef = useRef<HTMLHeadingElement>(null);
  const promptHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterNavigation = useRef(false);
  const exitFocus = useRef<HTMLElement | null>(null);
  const selectorRef = useRef<HTMLSelectElement>(null);
  const proceeding = useRef(false);
  const [selection, setSelection] = useState<DemoSelection>("basic-normalization");
  const [baseline, setBaseline] = useState(() => draftForDemoSelection("basic-normalization"));
  const [pendingSelection, setPendingSelection] = useState<DemoSelection>();
  const core = useSharedWorkspaceCore({
    ...(api ? { api } : {}),
    initialDraft: draftForDemoSelection("basic-normalization"),
    onAnalyzeSuccess: () => { focusAfterNavigation.current = true; goToAnalysis(); },
    onInvalidAnalysis: (issue) => {
      const selector = issue.field === "relationName" ? "#relation-name" : issue.field.startsWith("attribute:") ? `#attribute-${CSS.escape(issue.field.slice("attribute:".length))}` : issue.field === "attributes" ? ".add-button" : "#dependencies-heading";
      document.querySelector<HTMLElement>(selector)?.focus();
    },
  });
  const { draft } = core.state;
  const dirty = !sameDemoDraft(draft, baseline);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && workspaceResourceIdentity(currentLocation.pathname) !== workspaceResourceIdentity(nextLocation.pathname));

  useEffect(() => { document.title = "SchemaWise Demo — SchemaWise"; }, []);
  useEffect(() => { if (blocker.state === "blocked") promptHeadingRef.current?.focus(); }, [blocker.state]);
  useEffect(() => { if (pendingSelection) promptHeadingRef.current?.focus(); }, [pendingSelection]);
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

  function replaceSelection(nextSelection: DemoSelection) {
    if (nextSelection === selection) return;
    const nextDraft = draftForDemoSelection(nextSelection);
    core.abortOperations();
    core.replaceDraft(nextDraft);
    setSelection(nextSelection);
    setBaseline(nextDraft);
    setPendingSelection(undefined);
    goToSchema();
  }

  function requestSelection(nextSelection: DemoSelection) {
    if (nextSelection === selection) return;
    if (dirty) { setPendingSelection(nextSelection); return; }
    replaceSelection(nextSelection);
  }

  function keepWorking() {
    setPendingSelection(undefined);
    setTimeout(() => selectorRef.current?.focus());
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
    <WorkspaceSurfaces core={core} activeView={activeView} navigationBlocked={blocker.state === "blocked"} confirmExample={false} schemaToolbarAccessory={<div className="demo-example-picker"><label htmlFor="demo-example">Example</label><select ref={selectorRef} id="demo-example" value={selection} disabled={blocker.state === "blocked"} onChange={(event) => requestSelection(event.target.value as DemoSelection)}><option value="basic-normalization">Basic normalization</option><option value="composite-key">Composite key</option><option value="third-normal-form-vs-bcnf">3NF versus BCNF</option><option value="enrollment">Enrollment</option><option value="blank">Start from scratch</option></select>{selection === "blank" ? <p>Build a relation from an empty schema.</p> : <p>{demoFixtures[selection].description}</p>}</div>} schemaEditorNotice={pendingSelection ? <section className="inline-confirmation example-replacement-confirmation" role="alertdialog" aria-modal="false" aria-labelledby="demo-replace-heading"><div><h2 ref={promptHeadingRef} tabIndex={-1} id="demo-replace-heading">Replace current example?</h2><p>Your changes and analysis results will be discarded.</p></div><div className="button-row"><button className="button button--secondary" type="button" onClick={keepWorking}>Keep working</button><button className="button button--danger-solid" type="button" onClick={() => replaceSelection(pendingSelection)}>Replace example</button></div></section> : undefined} surfaceHeadingRef={surfaceHeadingRef} onNavigate={() => { focusAfterNavigation.current = true; }} emptyAnalysisMessage="No analysis is available yet. Go to Schema to analyze it." />
  </div>;
}
