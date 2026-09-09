import type { FastifyReply, FastifyRequest } from "fastify";

export const AUTH_SESSION_COOKIE_NAME = "schemawise_session";
export const AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface AuthCookieConfig {
  readonly secure: boolean;
}

export function readAuthCookieConfig(environment: NodeJS.ProcessEnv = process.env): AuthCookieConfig {
  const configured = environment.AUTH_COOKIE_SECURE;
  if (configured === "false") return { secure: false };
  if (configured === "true") return { secure: true };
  throw new Error("AUTH_COOKIE_SECURE is required and must be either true or false");
}

export function readSessionToken(request: FastifyRequest): string | undefined {
  return request.cookies[AUTH_SESSION_COOKIE_NAME];
}

export function setSessionCookie(
  reply: FastifyReply,
  rawToken: string,
  expiresAt: Date,
  config: AuthCookieConfig,
): void {
  reply.setCookie(AUTH_SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: config.secure,
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply, config: AuthCookieConfig): void {
  reply.clearCookie(AUTH_SESSION_COOKIE_NAME, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: config.secure,
  });
}
