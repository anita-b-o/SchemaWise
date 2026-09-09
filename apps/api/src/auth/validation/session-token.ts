const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isStructurallyValidSessionToken(input: unknown): input is string {
  return typeof input === "string" && SESSION_TOKEN_PATTERN.test(input);
}
