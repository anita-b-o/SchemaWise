import { Pool, type PoolConfig } from "pg";

export interface DatabaseConfig {
  readonly connectionString: string;
}

export function readDatabaseConfig(environment: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const connectionString = environment.DATABASE_URL;
  if (connectionString === undefined || connectionString.trim().length === 0) {
    throw new Error("DATABASE_URL is required");
  }
  return { connectionString };
}

export function createProjectPool(config: DatabaseConfig | PoolConfig = readDatabaseConfig()): Pool {
  return new Pool(config);
}

export async function closeProjectPool(pool: Pool): Promise<void> {
  await pool.end();
}
