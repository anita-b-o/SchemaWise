export type HttpApiErrorKind = "api" | "network" | "unexpected";

export class HttpApiError<Code extends string = string> extends Error {
  readonly kind: HttpApiErrorKind;
  readonly code: Code | undefined;
  readonly details: Record<string, unknown> | undefined;
  readonly status: number | undefined;

  constructor(init: { kind: HttpApiErrorKind; message: string; code?: Code; details?: Record<string, unknown>; status?: number }) {
    super(init.message);
    this.name = "HttpApiError";
    this.kind = init.kind;
    this.code = init.code;
    this.details = init.details;
    this.status = init.status;
  }
}

export const apiBaseUrl = (import.meta.env.VITE_SCHEMAWISE_API_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

function errorPayload(value: unknown): { code: string; message: string; details?: Record<string, unknown> } | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== "object" || error === null || Array.isArray(error)) return undefined;
  const candidate = error as Record<string, unknown>;
  if (typeof candidate.code !== "string" || typeof candidate.message !== "string") return undefined;
  return { code: candidate.code, message: candidate.message, ...(typeof candidate.details === "object" && candidate.details !== null && !Array.isArray(candidate.details) ? { details: candidate.details as Record<string, unknown> } : {}) };
}

export async function httpRequest<T, Code extends string = string>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/v1${path}`, init);
  } catch {
    throw new HttpApiError<Code>({ kind: "network", message: "Unable to reach SchemaWise API" });
  }
  if (response.status === 204) return undefined as T;
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new HttpApiError<Code>({ kind: "unexpected", message: "SchemaWise API returned invalid JSON", status: response.status }); }
  if (!response.ok) {
    const error = errorPayload(payload);
    if (error) throw new HttpApiError<Code>({ kind: "api", status: response.status, code: error.code as Code, message: error.message, ...(error.details ? { details: error.details } : {}) });
    throw new HttpApiError<Code>({ kind: "unexpected", message: "SchemaWise API returned an unexpected error", status: response.status });
  }
  return payload as T;
}

export function jsonRequest(method: "POST" | "PUT", body: unknown, csrfToken?: string): RequestInit {
  return { method, credentials: "include", headers: { "Content-Type": "application/json", ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) }, body: JSON.stringify(body) };
}
