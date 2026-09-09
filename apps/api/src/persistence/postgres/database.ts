import { Pool, type PoolConfig } from "pg";

export interface DatabaseConfig {
  readonly connectionString: string;
  readonly max: number;
  readonly connectionTimeoutMillis: number;
  readonly idleTimeoutMillis: number;
  readonly query_timeout: number;
}

export function readDatabaseConfig(environment: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const connectionString = environment.DATABASE_URL;
  if (connectionString === undefined || connectionString.trim().length === 0) {
    throw new Error("DATABASE_URL is required");
  }
  try {
    const parsed = new URL(connectionString);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") throw new Error();
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL");
  }

  const configuredMax = environment.DATABASE_POOL_MAX ?? "5";
  if (!/^[1-9][0-9]*$/.test(configuredMax)) {
    throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 20");
  }
  const max = Number(configuredMax);
  if (max > 20) throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 20");

  return {
    connectionString,
    max,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 5_000,
  };
}

export function createProjectPool(config: DatabaseConfig | PoolConfig = readDatabaseConfig()): Pool {
  return new Pool(config);
}

export async function closeProjectPool(pool: Pool): Promise<void> {
  await pool.end();
}
