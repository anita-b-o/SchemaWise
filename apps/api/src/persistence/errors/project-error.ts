export type ProjectErrorCode =
  | "INVALID_PROJECT"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_REVISION_CONFLICT"
  | "PROJECT_LIMIT_EXCEEDED"
  | "PERSISTENCE_ERROR";

export class ProjectApplicationError extends Error {
  readonly code: ProjectErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: ProjectErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "ProjectApplicationError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export function projectError(
  code: ProjectErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ProjectApplicationError {
  return new ProjectApplicationError(code, message, details);
}

export function persistenceError(): ProjectApplicationError {
  return projectError("PERSISTENCE_ERROR", "The project persistence operation failed.");
}

export function isProjectApplicationError(error: unknown): error is ProjectApplicationError {
  return error instanceof ProjectApplicationError;
}
