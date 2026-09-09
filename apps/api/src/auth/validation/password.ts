import { authError } from "../errors/auth-error.js";

export const REGISTRATION_PASSWORD_MIN_CODE_POINTS = 12;
export const PASSWORD_MAX_CODE_POINTS = 128;

function invalidPassword(): never {
  throw authError("INVALID_AUTH_REQUEST", "The password is invalid.", { field: "password" });
}

function codePointLength(password: string): number {
  return Array.from(password).length;
}

export function validateRegistrationPassword(input: unknown): string {
  if (typeof input !== "string") invalidPassword();
  const length = codePointLength(input);
  if (length < REGISTRATION_PASSWORD_MIN_CODE_POINTS || length > PASSWORD_MAX_CODE_POINTS) invalidPassword();
  return input;
}

/** Login deliberately has no registration minimum, so legacy credentials remain verifiable. */
export function validateLoginPassword(input: unknown): string {
  if (typeof input !== "string" || codePointLength(input) > PASSWORD_MAX_CODE_POINTS) invalidPassword();
  return input;
}
