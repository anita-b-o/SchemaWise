import type { Pool } from "pg";
import type { User } from "../model/user.js";
import type { CreateUserResult, UserRepository } from "../ports/user-repository.js";
import { isDuplicateUserEmail } from "./postgres-auth-helpers.js";

interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly password_hash: string;
  readonly created_at: Date;
  readonly updated_at: Date;
}

const USER_COLUMNS = "id, email, password_hash, created_at, updated_at";

function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async create(user: User): Promise<CreateUserResult> {
    try {
      await this.pool.query(
        `INSERT INTO users (id, email, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, user.email, user.passwordHash, user.createdAt, user.updatedAt],
      );
      return { kind: "created" };
    } catch (error) {
      if (isDuplicateUserEmail(error)) return { kind: "duplicate-email" };
      throw error;
    }
  }

  async findByCanonicalEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
      [email],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapUserRow(row);
  }

  async findById(userId: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
      [userId],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapUserRow(row);
  }
}
