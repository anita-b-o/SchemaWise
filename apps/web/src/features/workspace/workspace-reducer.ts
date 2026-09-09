import type { AnalysisResponseDto, BcnfDecompositionResponseDto, DependencyPreservationResponseDto, FunctionalDependencyDto, SchemaInputDto, ThirdNormalFormSynthesisResponseDto } from "../../api/schemawise-contracts";

export interface AttributeDraft { readonly id: string; readonly name: string; }
export interface SchemaDraft { readonly relationName: string; readonly attributes: readonly AttributeDraft[]; readonly functionalDependencies: readonly FunctionalDependencyDto[]; }
export type RequestStatus = "idle" | "loading" | "success" | "error";
export interface RequestState<T> { readonly status: RequestStatus; readonly requestId?: string; readonly data?: T; readonly error?: unknown; }
export interface AnalysisState extends RequestState<AnalysisResponseDto> { readonly inputRevision?: number; readonly inputSnapshot?: SchemaInputDto; readonly outOfDate: boolean; }
export interface TransformationState<T> extends RequestState<T> { readonly sourceRevision?: number; readonly inputSnapshot?: SchemaInputDto; }
export interface WorkspaceState { readonly draft: SchemaDraft; readonly revision: number; readonly analysis: AnalysisState; readonly synthesis: TransformationState<ThirdNormalFormSynthesisResponseDto>; readonly bcnf: TransformationState<BcnfDecompositionResponseDto>; readonly dependencyPreservation: TransformationState<DependencyPreservationResponseDto>; readonly requests: { readonly analysis: RequestState<unknown>; readonly synthesis: RequestState<unknown>; readonly bcnf: RequestState<unknown>; readonly dependencyPreservation: RequestState<unknown>; }; }
export type WorkspaceAction =
  | { type: "changeRelationName"; name: string } | { type: "addAttribute"; attribute: AttributeDraft } | { type: "renameAttribute"; id: string; name: string } | { type: "removeAttribute"; id: string }
  | { type: "addFunctionalDependency"; dependency: FunctionalDependencyDto } | { type: "updateFunctionalDependency"; index: number; dependency: FunctionalDependencyDto } | { type: "removeFunctionalDependency"; index: number } | { type: "loadExample"; ids?: { a: string; b: string; c: string } }
  | { type: "analysisRequestStart"; requestId: string } | { type: "analysisSuccess"; requestId: string; data: AnalysisResponseDto } | { type: "analysisError"; requestId: string; error: unknown }
  | { type: "synthesisRequestStart"; requestId: string } | { type: "synthesisSuccess"; requestId: string; data: ThirdNormalFormSynthesisResponseDto } | { type: "synthesisError"; requestId: string; error: unknown }
  | { type: "bcnfRequestStart"; requestId: string } | { type: "bcnfSuccess"; requestId: string; data: BcnfDecompositionResponseDto } | { type: "bcnfError"; requestId: string; error: unknown }
  | { type: "preservationRequestStart"; requestId: string } | { type: "preservationSuccess"; requestId: string; data: DependencyPreservationResponseDto } | { type: "preservationError"; requestId: string; error: unknown };

export function createInitialWorkspaceState(): WorkspaceState { return { draft: { relationName: "", attributes: [], functionalDependencies: [] }, revision: 0, analysis: { status: "idle", outOfDate: false }, synthesis: { status: "idle" }, bcnf: { status: "idle" }, dependencyPreservation: { status: "idle" }, requests: { analysis: { status: "idle" }, synthesis: { status: "idle" }, bcnf: { status: "idle" }, dependencyPreservation: { status: "idle" } } }; }
function id() { return `attr_${crypto.randomUUID()}`; }
function snapshot(draft: SchemaDraft): SchemaInputDto { return { relation: { name: draft.relationName, attributes: draft.attributes.map(({ id, name }) => ({ id, name })) }, functionalDependencies: draft.functionalDependencies.map(({ left, right }) => ({ left: [...left], right: [...right] })) }; }
export function draftToSchemaRequest(draft: SchemaDraft): SchemaInputDto { return snapshot(draft); }
export function analysisSnapshotToSchemaRequest(state: WorkspaceState): SchemaInputDto | undefined { return state.analysis.inputSnapshot; }
function mutate(state: WorkspaceState, draft: SchemaDraft): WorkspaceState { return { ...state, draft, revision: state.revision + 1, analysis: { ...state.analysis, outOfDate: state.analysis.status === "success" || state.analysis.inputSnapshot !== undefined } }; }
function setRequest<T>(state: WorkspaceState, key: keyof WorkspaceState["requests"], value: RequestState<T>) { return { ...state, requests: { ...state.requests, [key]: value } }; }
function startTransform<T>(state: WorkspaceState, key: "synthesis" | "bcnf" | "dependencyPreservation", requestId: string) { const input = state.analysis.inputSnapshot; return input ? { ...state, [key]: { status: "loading", requestId, sourceRevision: state.analysis.inputRevision, inputSnapshot: input }, requests: { ...state.requests, [key]: { status: "loading", requestId } } } as WorkspaceState : state; }
function finish<T>(state: WorkspaceState, key: "synthesis" | "bcnf" | "dependencyPreservation", requestId: string, result: RequestState<T>) { const current = state[key]; if (current.requestId !== requestId || current.status !== "loading") return state; return { ...state, [key]: { ...current, ...result }, requests: { ...state.requests, [key]: { ...result, requestId } } } as WorkspaceState; }
export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "changeRelationName": return mutate(state, { ...state.draft, relationName: action.name });
    case "addAttribute": return mutate(state, { ...state.draft, attributes: [...state.draft.attributes, { ...action.attribute, id: action.attribute.id || id() }] });
    case "renameAttribute": return mutate(state, { ...state.draft, attributes: state.draft.attributes.map((a) => a.id === action.id ? { ...a, name: action.name } : a) });
    case "removeAttribute": return mutate(state, { ...state.draft, attributes: state.draft.attributes.filter((a) => a.id !== action.id), functionalDependencies: state.draft.functionalDependencies.filter((fd) => !fd.left.includes(action.id) && !fd.right.includes(action.id)).map((fd) => ({ left: [...fd.left], right: [...fd.right] })) });
    case "addFunctionalDependency": return mutate(state, { ...state.draft, functionalDependencies: [...state.draft.functionalDependencies, { left: [...action.dependency.left], right: [...action.dependency.right] }] });
    case "updateFunctionalDependency": return mutate(state, { ...state.draft, functionalDependencies: state.draft.functionalDependencies.map((fd, i) => i === action.index ? { left: [...action.dependency.left], right: [...action.dependency.right] } : fd) });
    case "removeFunctionalDependency": return mutate(state, { ...state.draft, functionalDependencies: state.draft.functionalDependencies.filter((_, i) => i !== action.index) });
    case "loadExample": { const ids = action.ids ?? { a: id(), b: id(), c: id() }; return mutate(state, { relationName: "R", attributes: [{ id: ids.a, name: "A" }, { id: ids.b, name: "B" }, { id: ids.c, name: "C" }], functionalDependencies: [{ left: [ids.a], right: [ids.b] }, { left: [ids.b], right: [ids.c] }] }); }
    case "analysisRequestStart": return { ...state, analysis: { status: "loading", requestId: action.requestId, outOfDate: false }, requests: { ...state.requests, analysis: { status: "loading", requestId: action.requestId } } };
    case "analysisSuccess": if (state.analysis.requestId !== action.requestId) return state; return { ...state, analysis: { status: "success", requestId: action.requestId, data: action.data, inputRevision: state.revision, inputSnapshot: snapshot(state.draft), outOfDate: false }, requests: { ...state.requests, analysis: { status: "success", requestId: action.requestId, data: action.data } } };
    case "analysisError": if (state.analysis.requestId !== action.requestId) return state; return { ...state, analysis: { ...state.analysis, status: "error", error: action.error }, requests: { ...state.requests, analysis: { status: "error", requestId: action.requestId, error: action.error } } };
    case "synthesisRequestStart": return startTransform(state, "synthesis", action.requestId);
    case "synthesisSuccess": return finish(state, "synthesis", action.requestId, { status: "success", data: action.data });
    case "synthesisError": return finish(state, "synthesis", action.requestId, { status: "error", error: action.error });
    case "bcnfRequestStart": return startTransform(state, "bcnf", action.requestId);
    case "bcnfSuccess": return finish(state, "bcnf", action.requestId, { status: "success", data: action.data });
    case "bcnfError": return finish(state, "bcnf", action.requestId, { status: "error", error: action.error });
    case "preservationRequestStart": return startTransform(state, "dependencyPreservation", action.requestId);
    case "preservationSuccess": return finish(state, "dependencyPreservation", action.requestId, { status: "success", data: action.data });
    case "preservationError": return finish(state, "dependencyPreservation", action.requestId, { status: "error", error: action.error });
  }
}
