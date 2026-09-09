import { authError } from "../errors/auth-error.js";

const WHITESPACE_OR_CONTROL = /[\s\p{Cc}\p{Cf}]/u;

function invalidEmail(): never {
  throw authError("INVALID_AUTH_REQUEST", "The email address is invalid.", { field: "email" });
}

export function normalizeEmail(input: unknown): string {
  if (typeof input !== "string") invalidEmail();

  const canonical = input.trim().toLowerCase();
  if (Array.from(canonical).length > 254 || WHITESPACE_OR_CONTROL.test(canonical)) invalidEmail();

  const firstAt = canonical.indexOf("@");
  if (firstAt <= 0 || firstAt !== canonical.lastIndexOf("@") || firstAt === canonical.length - 1) invalidEmail();

  return canonical;
}
