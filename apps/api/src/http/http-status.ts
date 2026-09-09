import type { ApplicationErrorCode } from "../errors/application-error.js";

export function statusForApplicationError(code: ApplicationErrorCode): number {
  switch (code) {
    case "ANALYSIS_LIMIT_EXCEEDED": return 422;
    case "INTERNAL_ERROR": return 500;
    default: return 400;
  }
}
