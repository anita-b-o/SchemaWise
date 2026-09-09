import { readAuthCookieConfig, type AuthCookieConfig } from "../http/auth-cookie.js";
import { parseCorsOrigins, readClientIpMode, readCsrfSecret, readStagingProxySecret, type ClientIpMode } from "../http/auth-security.js";
import { readDatabaseConfig, type DatabaseConfig } from "../persistence/postgres/database.js";

export interface RuntimeConfig {
  readonly database: DatabaseConfig;
  readonly authCookie: AuthCookieConfig;
  readonly csrfSecret: string;
  readonly corsOrigins: readonly string[];
  readonly clientIpMode: ClientIpMode;
  readonly stagingProxySecret: string | undefined;
  readonly host: string;
  readonly port: number;
}

function readPort(value: string | undefined): number {
  const configured = value ?? "3000";
  if (!/^[1-9][0-9]*$/.test(configured)) throw new Error("PORT must be an integer between 1 and 65535");
  const port = Number(configured);
  if (port > 65_535) throw new Error("PORT must be an integer between 1 and 65535");
  return port;
}

export function readRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const production = environment.NODE_ENV === "production";
  const authCookie = readAuthCookieConfig(environment);
  if (production && !authCookie.secure) {
    throw new Error("AUTH_COOKIE_SECURE must be true when NODE_ENV=production");
  }
  if (production && environment.CORS_ORIGINS === undefined) {
    throw new Error("CORS_ORIGINS is required when NODE_ENV=production");
  }
  if (production && environment.CLIENT_IP_MODE === undefined) {
    throw new Error("CLIENT_IP_MODE is required when NODE_ENV=production");
  }
  const clientIpMode = readClientIpMode(environment);
  const corsOrigins = parseCorsOrigins(environment.CORS_ORIGINS);
  if (corsOrigins.length === 0) throw new Error("CORS_ORIGINS must contain at least one origin");

  const host = environment.HOST ?? "0.0.0.0";
  if (host.trim().length === 0 || /[\r\n]/.test(host)) throw new Error("HOST must be a non-empty hostname or address");

  return {
    database: readDatabaseConfig(environment),
    authCookie,
    csrfSecret: readCsrfSecret(environment),
    corsOrigins,
    clientIpMode,
    stagingProxySecret: readStagingProxySecret(clientIpMode, environment),
    host,
    port: readPort(environment.PORT),
  };
}
