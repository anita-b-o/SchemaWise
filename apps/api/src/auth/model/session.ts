/**
 * A persisted SHA-256 digest encoded as 64 lowercase hexadecimal characters.
 * PostgreSQL adapters convert this value to and from the `bytea` representation.
 */
export type SessionTokenHash = string;

export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: SessionTokenHash;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}
