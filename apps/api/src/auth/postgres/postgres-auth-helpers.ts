import type { SessionTokenHash } from "../model/session.js";

interface PostgresError {
  readonly code?: unknown;
  readonly constraint?: unknown;
}

export function isDuplicateUserEmail(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const postgresError = error as PostgresError;
  return postgresError.code === "23505" && postgresError.constraint === "users_email_key";
}

export function tokenHashBuffer(tokenHash: SessionTokenHash): Buffer {
  if (!/^[0-9a-f]{64}$/.test(tokenHash)) throw new Error("Invalid session token hash");
  return Buffer.from(tokenHash, "hex");
}
