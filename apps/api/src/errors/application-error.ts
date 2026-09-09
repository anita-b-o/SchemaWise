export type ApplicationErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_RELATION"
  | "INVALID_ATTRIBUTE"
  | "INVALID_FUNCTIONAL_DEPENDENCY"
  | "ATTRIBUTE_IDENTITY_COLLISION"
  | "UNKNOWN_ATTRIBUTE_REFERENCE"
  | "SCHEMA_SCOPE_VIOLATION"
  | "INCOMPLETE_DECOMPOSITION"
  | "ANALYSIS_LIMIT_EXCEEDED"
  | "OPERATION_TIMEOUT"
  | "INTERNAL_ERROR";

export interface ApplicationErrorShape {
  readonly code: ApplicationErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class ApplicationError extends Error implements ApplicationErrorShape {
  readonly code: ApplicationErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: ApplicationErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "ApplicationError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export function applicationError(
  code: ApplicationErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ApplicationError {
  return new ApplicationError(code, message, details);
}

export function translateEngineError(error: unknown): ApplicationError {
  const message = error instanceof Error ? error.message : "Unknown engine error";
  if (message.includes("identity conflict")) {
    return applicationError("ATTRIBUTE_IDENTITY_COLLISION", "Attribute identities are inconsistent.");
  }
  if (message.includes("must be a subset of relation")) {
    return applicationError("SCHEMA_SCOPE_VIOLATION", "An engine operation received attributes outside the relation scope.");
  }
  return applicationError("INTERNAL_ERROR", "The normalization operation failed.");
}

export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}
