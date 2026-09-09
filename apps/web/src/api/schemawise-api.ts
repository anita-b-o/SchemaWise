import { ERROR_CODES, type BcnfDecompositionRequestDto, type BcnfDecompositionResponseDto, type ClosureRequestDto, type ClosureResponseDto, type DependencyPreservationRequestDto, type DependencyPreservationResponseDto, type ErrorCode, type ErrorEnvelope, type AnalysisResponseDto, type SchemaAnalysisRequestDto, type ThirdNormalFormSynthesisResponseDto } from "./schemawise-contracts";

export type ApiErrorKind = "api" | "network" | "aborted" | "unexpected";
export class SchemaWiseApiError extends Error {
  readonly kind!: ApiErrorKind; readonly code?: ErrorCode; readonly details?: Record<string, unknown>; readonly status?: number;
  constructor(init: { kind: ApiErrorKind; message: string; code?: ErrorCode; details?: Record<string, unknown>; status?: number }) { super(init.message); this.name = "SchemaWiseApiError"; Object.assign(this, init); }
}
export interface SchemaWiseApi {
  analyzeSchema(input: SchemaAnalysisRequestDto, signal?: AbortSignal): Promise<AnalysisResponseDto>;
  calculateClosure(input: ClosureRequestDto, signal?: AbortSignal): Promise<ClosureResponseDto>;
  synthesizeThirdNormalForm(input: SchemaAnalysisRequestDto, signal?: AbortSignal): Promise<ThirdNormalFormSynthesisResponseDto>;
  decomposeBoyceCodd(input: BcnfDecompositionRequestDto, signal?: AbortSignal): Promise<BcnfDecompositionResponseDto>;
  analyzeDependencyPreservation(input: DependencyPreservationRequestDto, signal?: AbortSignal): Promise<DependencyPreservationResponseDto>;
}

const baseUrl = (import.meta.env.VITE_SCHEMAWISE_API_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const API_PREFIX = "/api/v1";
function isEnvelope(value: unknown): value is ErrorEnvelope { const e = (value as ErrorEnvelope | null)?.error; return !!e && typeof e.code === "string" && (ERROR_CODES as readonly string[]).includes(e.code) && typeof e.message === "string"; }
async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch(`${baseUrl}${API_PREFIX}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), ...(signal ? { signal } : {}) }); }
  catch (error) { if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw new SchemaWiseApiError({ kind: "aborted", message: "Request aborted" }); throw new SchemaWiseApiError({ kind: "network", message: "Unable to reach SchemaWise API" }); }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new SchemaWiseApiError({ kind: "unexpected", message: "SchemaWise API returned invalid JSON", status: response.status }); }
  if (!response.ok) { if (isEnvelope(payload)) { const init = { kind: "api" as const, message: payload.error.message, code: payload.error.code, status: response.status, ...(payload.error.details ? { details: payload.error.details } : {}) }; throw new SchemaWiseApiError(init); } throw new SchemaWiseApiError({ kind: "unexpected", message: "SchemaWise API returned an unexpected error", status: response.status }); }
  return payload as T;
}
export const schemawiseApi: SchemaWiseApi = {
  analyzeSchema: (input, signal) => post("/analysis", input, signal),
  calculateClosure: (input, signal) => post("/closure", input, signal),
  synthesizeThirdNormalForm: (input, signal) => post("/synthesis/3nf", input, signal),
  decomposeBoyceCodd: (input, signal) => post("/decomposition/bcnf", input, signal),
  analyzeDependencyPreservation: (input, signal) => post("/analysis/dependency-preservation", input, signal),
};
