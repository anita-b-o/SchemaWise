import type { SessionTokenHash } from "../model/session.js";

export interface GeneratedSessionToken {
  readonly rawToken: string;
  readonly tokenHash: SessionTokenHash;
}

export interface SessionTokenGenerator {
  generate(): Promise<GeneratedSessionToken>;
  hash(rawToken: string): Promise<SessionTokenHash>;
}
