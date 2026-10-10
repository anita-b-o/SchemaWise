import { useEffect, useReducer, useRef, type ReactNode } from "react";
import { schemawiseApi, SchemaWiseApiError, type SchemaWiseApi } from "../../api/schemawise-api";
import { createInitialWorkspaceState, draftToSchemaRequest, workspaceReducer, type SchemaDraft, type WorkspaceAction, type WorkspaceState } from "./workspace-reducer";
import { validateDraft, type ValidationIssue } from "./workspace-validation";

/**
 * The mathematical workspace is deliberately independent of resource hosting.
 * It owns one reducer, its request lifecycle, and only the public mathematical
 * API. Project identity, authentication, and persistence stay in a host.
 */
export interface SharedWorkspaceCoreOptions {
  readonly api?: SchemaWiseApi;
  readonly initialDraft?: SchemaDraft;
  readonly onAnalyzeSuccess?: () => void;
  readonly onInvalidAnalysis?: (issue: ValidationIssue) => void;
}

export interface SharedWorkspaceCore {
  readonly state: WorkspaceState;
  readonly issues: readonly ValidationIssue[];
  dispatch(action: WorkspaceAction): void;
  replaceDraft(draft: SchemaDraft): void;
  resetWorkspace(): void;
  abortOperations(): void;
  calculateClosure(selectedAttributes: readonly string[]): Promise<void>;
  analyze(): Promise<void>;
  generateSynthesis(): Promise<void>;
  generateBcnf(): Promise<void>;
  checkDependencyPreservation(): Promise<void>;
}

/** A host-neutral composition point for a future resource host (including Demo). */
export function SharedWorkspaceCore({ children, ...options }: SharedWorkspaceCoreOptions & { readonly children: (core: SharedWorkspaceCore) => ReactNode }) {
  return children(useSharedWorkspaceCore(options));
}

export function useSharedWorkspaceCore({ api = schemawiseApi, initialDraft, onAnalyzeSuccess, onInvalidAnalysis }: SharedWorkspaceCoreOptions = {}): SharedWorkspaceCore {
  const [state, dispatch] = useReducer(workspaceReducer, initialDraft, (draft) => draft
    ? workspaceReducer(createInitialWorkspaceState(), { type: "replaceDraft", draft })
    : createInitialWorkspaceState());
  const stateRef = useRef(state);
  stateRef.current = state;
  const callbacks = useRef({ onAnalyzeSuccess, onInvalidAnalysis });
  callbacks.current = { onAnalyzeSuccess, onInvalidAnalysis };
  const active = useRef<Record<"analysis" | "closure" | "synthesis" | "bcnf" | "preservation", AbortController | undefined>>({ analysis: undefined, closure: undefined, synthesis: undefined, bcnf: undefined, preservation: undefined });

  function abortOperations() {
    Object.values(active.current).forEach((controller) => controller?.abort());
    // AbortController is cooperative: a client or test double may still settle
    // after abort. Clearing ownership makes every such late completion inert.
    active.current = { analysis: undefined, closure: undefined, synthesis: undefined, bcnf: undefined, preservation: undefined };
  }

  useEffect(() => () => abortOperations(), []);

  async function calculateClosure(selectedAttributes: readonly string[]) {
    const current = stateRef.current;
    if (validateDraft(current.draft).length > 0) return;
    active.current.closure?.abort();
    const controller = new AbortController();
    active.current.closure = controller;
    const requestId = crypto.randomUUID();
    const inputSnapshot = draftToSchemaRequest(current.draft);
    dispatch({ type: "closureRequestStart", requestId, inputRevision: current.revision, inputSnapshot, selectedAttributes });
    try {
      const data = await api.calculateClosure({ ...inputSnapshot, attributes: [...selectedAttributes] }, controller.signal);
      if (active.current.closure === controller) dispatch({ type: "closureSuccess", requestId, data });
    } catch (error) {
      if (active.current.closure !== controller) return;
      if (error instanceof SchemaWiseApiError && error.kind === "aborted") dispatch({ type: "closureAborted", requestId });
      else dispatch({ type: "closureError", requestId, error });
    } finally {
      if (active.current.closure === controller) active.current.closure = undefined;
    }
  }

  async function analyze() {
    const current = stateRef.current;
    const issues = validateDraft(current.draft);
    if (issues.length > 0) {
      const first = issues[0];
      if (first) callbacks.current.onInvalidAnalysis?.(first);
      return;
    }
    active.current.analysis?.abort();
    const controller = new AbortController();
    active.current.analysis = controller;
    const requestId = crypto.randomUUID();
    const inputSnapshot = draftToSchemaRequest(current.draft);
    dispatch({ type: "analysisRequestStart", requestId, inputRevision: current.revision, inputSnapshot });
    try {
      const data = await api.analyzeSchema(inputSnapshot, controller.signal);
      if (active.current.analysis !== controller) return;
      dispatch({ type: "analysisSuccess", requestId, data });
      callbacks.current.onAnalyzeSuccess?.();
    } catch (error) {
      if (active.current.analysis !== controller) return;
      if (error instanceof SchemaWiseApiError && error.kind === "aborted") dispatch({ type: "analysisAborted", requestId });
      else dispatch({ type: "analysisError", requestId, error });
    } finally {
      if (active.current.analysis === controller) active.current.analysis = undefined;
    }
  }

  async function generateSynthesis() {
    const current = stateRef.current;
    if (!current.analysis.inputSnapshot || current.analysis.outOfDate) return;
    active.current.synthesis?.abort();
    const controller = new AbortController();
    active.current.synthesis = controller;
    const requestId = crypto.randomUUID();
    const inputSnapshot = current.analysis.inputSnapshot;
    dispatch({ type: "synthesisRequestStart", requestId });
    try {
      const data = await api.synthesizeThirdNormalForm(inputSnapshot, controller.signal);
      if (active.current.synthesis === controller) dispatch({ type: "synthesisSuccess", requestId, data });
    } catch (error) {
      if (active.current.synthesis !== controller) return;
      const aborted = error instanceof SchemaWiseApiError && error.kind === "aborted";
      if (aborted) dispatch({ type: "synthesisAborted", requestId });
      else dispatch({ type: "synthesisError", requestId, error });
    } finally {
      if (active.current.synthesis === controller) active.current.synthesis = undefined;
    }
  }

  async function generateBcnf() {
    const current = stateRef.current;
    if (!current.analysis.inputSnapshot || current.analysis.outOfDate) return;
    active.current.bcnf?.abort();
    const controller = new AbortController();
    active.current.bcnf = controller;
    const requestId = crypto.randomUUID();
    const inputSnapshot = current.analysis.inputSnapshot;
    dispatch({ type: "bcnfRequestStart", requestId });
    try {
      const data = await api.decomposeBoyceCodd(inputSnapshot, controller.signal);
      if (active.current.bcnf === controller) dispatch({ type: "bcnfSuccess", requestId, data });
    } catch (error) {
      if (active.current.bcnf !== controller) return;
      if (error instanceof SchemaWiseApiError && error.kind === "aborted") dispatch({ type: "bcnfAborted", requestId });
      else dispatch({ type: "bcnfError", requestId, error });
    } finally {
      if (active.current.bcnf === controller) active.current.bcnf = undefined;
    }
  }

  async function checkDependencyPreservation() {
    const current = stateRef.current;
    if (!current.analysis.inputSnapshot || !current.bcnf.data || current.analysis.outOfDate) return;
    active.current.preservation?.abort();
    const controller = new AbortController();
    active.current.preservation = controller;
    const requestId = crypto.randomUUID();
    const request = { ...current.analysis.inputSnapshot, decomposition: current.bcnf.data.relations.map((relation) => [...relation.attributes]) };
    dispatch({ type: "preservationRequestStart", requestId });
    try {
      const data = await api.analyzeDependencyPreservation(request, controller.signal);
      if (active.current.preservation === controller) dispatch({ type: "preservationSuccess", requestId, data });
    } catch (error) {
      if (active.current.preservation !== controller) return;
      if (error instanceof SchemaWiseApiError && error.kind === "aborted") dispatch({ type: "preservationAborted", requestId });
      else dispatch({ type: "preservationError", requestId, error });
    } finally {
      if (active.current.preservation === controller) active.current.preservation = undefined;
    }
  }

  return {
    state,
    issues: validateDraft(state.draft),
    dispatch,
    replaceDraft: (draft) => { abortOperations(); dispatch({ type: "replaceDraft", draft }); },
    resetWorkspace: () => { abortOperations(); dispatch({ type: "resetWorkspace" }); },
    abortOperations,
    calculateClosure,
    analyze,
    generateSynthesis,
    generateBcnf,
    checkDependencyPreservation,
  };
}
