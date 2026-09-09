import type { Pool } from "pg";
import type { Session, SessionTokenHash } from "../model/session.js";
import type { SessionRepository } from "../ports/session-repository.js";
import { tokenHashBuffer } from "./postgres-auth-helpers.js";

interface SessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly token_hash: Buffer;
  readonly expires_at: Date;
  readonly created_at: Date;
}

const SESSION_COLUMNS = "id, user_id, token_hash, expires_at, created_at";

function mapSessionRow(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash.toString("hex"),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly pool: Pool) {}

  async create(session: Session): Promise<void> {
    await this.pool.query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [session.id, session.userId, tokenHashBuffer(session.tokenHash), session.expiresAt, session.createdAt],
    );
  }

  async findActiveByTokenHash(tokenHash: SessionTokenHash, now: Date): Promise<Session | null> {
    const result = await this.pool.query<SessionRow>(
      `SELECT ${SESSION_COLUMNS}
       FROM sessions
       WHERE token_hash = $1 AND expires_at > $2`,
      [tokenHashBuffer(tokenHash), now],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapSessionRow(row);
  }

  async deleteByTokenHash(tokenHash: SessionTokenHash): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHashBuffer(tokenHash)]);
  }
}
