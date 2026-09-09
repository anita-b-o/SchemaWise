import type { Session, SessionTokenHash } from "../model/session.js";

export interface SessionRepository {
  create(session: Session): Promise<void>;
  findActiveByTokenHash(tokenHash: SessionTokenHash, now: Date): Promise<Session | null>;
  deleteByTokenHash(tokenHash: SessionTokenHash): Promise<void>;
}
