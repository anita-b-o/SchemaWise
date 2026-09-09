import type { FastifyRequest } from "fastify";
import type { AuthRuntime } from "../auth/runtime/auth-runtime.js";
import type { PublicUser } from "../auth/model/user.js";
import { readSessionToken } from "./auth-cookie.js";

export interface AuthContext {
  readonly userId: string;
  readonly user: PublicUser;
  readonly sessionId: string;
}

export async function resolveAuthenticatedUser(
  request: FastifyRequest,
  auth: AuthRuntime,
): Promise<AuthContext> {
  const authenticated = await auth.authenticate(readSessionToken(request));
  return { userId: authenticated.user.id, user: authenticated.user, sessionId: authenticated.sessionId };
}
