import type { PublicUser } from "./user.js";

/** Ephemeral bearer credential returned only to the future transport adapter. */
export interface SessionCredential {
  readonly id: string;
  readonly token: string;
  readonly expiresAt: Date;
}

export interface AuthenticatedSession {
  readonly user: PublicUser;
  readonly session: SessionCredential;
}
