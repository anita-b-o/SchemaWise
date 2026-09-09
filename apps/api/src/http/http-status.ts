import type { ApplicationErrorCode } from "../errors/application-error.js";
import type { AuthErrorCode } from "../auth/errors/auth-error.js";

export function statusForApplicationError(code: ApplicationErrorCode): number {
  switch (code) {
    case "ANALYSIS_LIMIT_EXCEEDED": return 422;
    case "INTERNAL_ERROR": return 500;
    default: return 400;
  }
}

export function statusForAuthError(code: AuthErrorCode): number {
  switch (code) {
    case "INVALID_AUTH_REQUEST": return 400;
    case "INVALID_CREDENTIALS":
    case "UNAUTHENTICATED": return 401;
    case "EMAIL_ALREADY_EXISTS": return 409;
    case "AUTH_RATE_LIMITED": return 429;
    case "AUTH_INTERNAL_ERROR": return 500;
  }
}
