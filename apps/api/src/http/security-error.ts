export type HttpSecurityErrorCode = "INVALID_CSRF_TOKEN" | "INVALID_CLIENT_IP";

export class HttpSecurityError extends Error {
  readonly code: HttpSecurityErrorCode;

  constructor(code: HttpSecurityErrorCode, message: string) {
    super(message);
    this.name = "HttpSecurityError";
    this.code = code;
  }
}

export function httpSecurityError(code: HttpSecurityErrorCode, message: string): HttpSecurityError {
  return new HttpSecurityError(code, message);
}

export function isHttpSecurityError(error: unknown): error is HttpSecurityError {
  return error instanceof HttpSecurityError;
}
