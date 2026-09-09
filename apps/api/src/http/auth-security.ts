import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { normalizeIP } from "@fastify/rate-limit";
import type { FastifyRequest } from "fastify";
import { normalizeEmail } from "../auth/validation/email.js";
import { httpSecurityError } from "./security-error.js";

const CSRF_DOMAIN = "schemawise:csrf:v1\0";
const CSRF_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MINIMUM_CSRF_SECRET_BYTES = 32;

export const DEFAULT_CORS_ORIGINS = Object.freeze([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
]);

export interface AuthRateLimitConfig {
  readonly loginIpMax: number;
  readonly loginEmailIpMax: number;
  readonly loginWindowMs: number;
  readonly registerIpMax: number;
  readonly registerWindowMs: number;
}

export const DEFAULT_AUTH_RATE_LIMITS: AuthRateLimitConfig = Object.freeze({
  loginIpMax: 20,
  loginEmailIpMax: 5,
  loginWindowMs: 15 * 60 * 1_000,
  registerIpMax: 5,
  registerWindowMs: 60 * 60 * 1_000,
});

function invalidCsrf(): never {
  throw httpSecurityError("INVALID_CSRF_TOKEN", "The CSRF validation failed.");
}

export function validateCsrfSecret(secret: string): string {
  if (Buffer.byteLength(secret, "utf8") < MINIMUM_CSRF_SECRET_BYTES) {
    throw new Error("CSRF_SECRET is required and must contain at least 32 bytes");
  }
  return secret;
}

export function readCsrfSecret(environment: NodeJS.ProcessEnv = process.env): string {
  return validateCsrfSecret(environment.CSRF_SECRET ?? "");
}

export function deriveCsrfToken(secret: string, sessionId: string): string {
  return createHmac("sha256", validateCsrfSecret(secret))
    .update(CSRF_DOMAIN, "utf8")
    .update(sessionId, "utf8")
    .digest("base64url");
}

export function assertValidCsrfToken(candidate: unknown, secret: string, sessionId: string): void {
  if (typeof candidate !== "string" || !CSRF_TOKEN_PATTERN.test(candidate)) invalidCsrf();
  const expected = Buffer.from(deriveCsrfToken(secret, sessionId), "base64url");
  const actual = Buffer.from(candidate, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) invalidCsrf();
}

export function parseCorsOrigins(value: string | undefined): readonly string[] {
  if (value === undefined) return DEFAULT_CORS_ORIGINS;
  const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean);
  for (const origin of origins) {
    let parsed: URL;
    try { parsed = new URL(origin); } catch { throw new Error(`Invalid CORS_ORIGINS entry: ${origin}`); }
    if (parsed.origin !== origin || parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "") {
      throw new Error(`CORS_ORIGINS entries must be serialized origins: ${origin}`);
    }
  }
  return origins;
}

/**
 * Present browser provenance must match exactly. Headerless requests are
 * accepted for explicit non-browser clients; CSRF still protects active sessions.
 */
export function assertAllowedRequestOrigin(request: FastifyRequest, allowedOrigins: readonly string[]): void {
  const origin = request.headers.origin;
  if (origin !== undefined) {
    if (!allowedOrigins.includes(origin)) invalidCsrf();
    return;
  }

  const referer = request.headers.referer;
  if (referer === undefined) return;
  let refererOrigin: string;
  try { refererOrigin = new URL(referer).origin; } catch { invalidCsrf(); }
  if (!allowedOrigins.includes(refererOrigin)) invalidCsrf();
}

export function readTrustProxy(environment: NodeJS.ProcessEnv = process.env): boolean {
  const configured = environment.TRUST_PROXY;
  if (configured === undefined || configured === "false") return false;
  if (configured === "true") return true;
  throw new Error("TRUST_PROXY must be either true or false");
}

function emailKeyMaterial(body: unknown): string {
  const email = typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>).email
    : undefined;
  try {
    return `valid:${normalizeEmail(email)}`;
  } catch {
    const typed = typeof email === "string" ? `string:${email.slice(0, 512)}` : `${typeof email}:${String(email).slice(0, 128)}`;
    return `invalid:${typed}`;
  }
}

export function loginEmailIpRateLimitKey(request: FastifyRequest): string {
  const emailDigest = createHash("sha256").update(emailKeyMaterial(request.body), "utf8").digest("base64url");
  return `${normalizeIP(request.ip)}:${emailDigest}`;
}
