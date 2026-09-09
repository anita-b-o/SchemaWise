export type AuthErrorCode =
  | "INVALID_AUTH_REQUEST"
  | "EMAIL_ALREADY_EXISTS"
  | "INVALID_CREDENTIALS"
  | "UNAUTHENTICATED"
  | "AUTH_RATE_LIMITED"
  | "AUTH_INTERNAL_ERROR";

export class AuthApplicationError extends Error {
  readonly code: AuthErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: AuthErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "AuthApplicationError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export function authError(
  code: AuthErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): AuthApplicationError {
  return new AuthApplicationError(code, message, details);
}

export function authInternalError(): AuthApplicationError {
  return authError("AUTH_INTERNAL_ERROR", "The authentication operation failed.");
}

export function isAuthApplicationError(error: unknown): error is AuthApplicationError {
  return error instanceof AuthApplicationError;
}
