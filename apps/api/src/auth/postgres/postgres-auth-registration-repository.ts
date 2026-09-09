import type { Pool } from "pg";
import type { Session } from "../model/session.js";
import type { User } from "../model/user.js";
import type { AuthRegistrationRepository, AuthRegistrationResult } from "../ports/auth-registration-repository.js";
import { isDuplicateUserEmail, tokenHashBuffer } from "./postgres-auth-helpers.js";

export class PostgresAuthRegistrationRepository implements AuthRegistrationRepository {
  constructor(private readonly pool: Pool) {}

  async createUserWithSession(user: User, session: Session): Promise<AuthRegistrationResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO users (id, email, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, user.email, user.passwordHash, user.createdAt, user.updatedAt],
      );
      await client.query(
        `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [session.id, session.userId, tokenHashBuffer(session.tokenHash), session.expiresAt, session.createdAt],
      );
      await client.query("COMMIT");
      return { kind: "created" };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original database failure for the application boundary.
      }
      if (isDuplicateUserEmail(error)) return { kind: "duplicate-email" };
      throw error;
    } finally {
      client.release();
    }
  }
}
