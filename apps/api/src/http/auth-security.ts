import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  PROXY_ASSERTION_HEADERS,
  ProxyAssertionError,
  canonicalizeClientIp,
  validateProxySecret,
  verifyProxyAssertion,
} from "@schemawise/proxy-assertion";
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

export type ClientIpMode = "direct" | "render" | "vercel-proxy";

export function readClientIpMode(environment: NodeJS.ProcessEnv = process.env): ClientIpMode {
  const configured = environment.CLIENT_IP_MODE;
  if (configured === undefined || configured === "direct") return "direct";
  if (configured === "render") return "render";
  if (configured === "vercel-proxy") return "vercel-proxy";
  throw new Error("CLIENT_IP_MODE must be direct, render, or vercel-proxy");
}

export function readStagingProxySecret(
  mode: ClientIpMode,
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (mode !== "vercel-proxy") return undefined;
  return validateProxySecret(environment.STAGING_PROXY_SECRET);
}

/**
 * Resolve and normalize the security identity used by authentication limits.
 * Render mode relies on Render's documented guarantee that its Cloudflare edge
 * overwrites CF-Connecting-IP before every request reaches a web service.
 */
const VERIFIED_PROXY_IP = Symbol("schemawise.verifiedProxyIp");
type ProxyVerifiedRequest = FastifyRequest & { [VERIFIED_PROXY_IP]?: string };

function invalidProxyAssertion(): never {
  throw httpSecurityError("INVALID_PROXY_ASSERTION", "Request proxy identity could not be verified.");
}

export function assertValidProxyRequest(request: FastifyRequest, secret: string): string {
  const cached = (request as ProxyVerifiedRequest)[VERIFIED_PROXY_IP];
  if (cached !== undefined) return cached;
  try {
    const clientIp = verifyProxyAssertion({
      method: request.method,
      pathAndQuery: request.url,
      clientIp: request.headers[PROXY_ASSERTION_HEADERS.ip],
      timestamp: request.headers[PROXY_ASSERTION_HEADERS.timestamp],
      signature: request.headers[PROXY_ASSERTION_HEADERS.signature],
      secret,
    });
    (request as ProxyVerifiedRequest)[VERIFIED_PROXY_IP] = clientIp;
    return clientIp;
  } catch (error) {
    if (error instanceof ProxyAssertionError) invalidProxyAssertion();
    throw error;
  }
}

export function resolveClientIp(request: FastifyRequest, mode: ClientIpMode, proxySecret?: string): string {
  if (mode === "vercel-proxy") {
    if (proxySecret === undefined) throw new Error("STAGING_PROXY_SECRET is required in vercel-proxy mode");
    return assertValidProxyRequest(request, proxySecret);
  }
  const candidate = mode === "direct" ? request.socket.remoteAddress : request.headers["cf-connecting-ip"];
  try {
    return canonicalizeClientIp(candidate);
  } catch (error) {
    if (!(error instanceof ProxyAssertionError)) throw error;
    throw httpSecurityError("INVALID_CLIENT_IP", "Request client identity could not be verified.");
  }
}

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

export function loginEmailIpRateLimitKey(request: FastifyRequest, mode: ClientIpMode = "direct", proxySecret?: string): string {
  const emailDigest = createHash("sha256").update(emailKeyMaterial(request.body), "utf8").digest("base64url");
  return `${resolveClientIp(request, mode, proxySecret)}:${emailDigest}`;
}
