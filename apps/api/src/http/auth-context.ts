import type { FastifyRequest } from "fastify";
import type { AuthRuntime } from "../auth/runtime/auth-runtime.js";
import type { PublicUser } from "../auth/model/user.js";
import { readSessionToken } from "./auth-cookie.js";

export interface AuthContext {
  readonly userId: string;
  readonly user: PublicUser;
}

export async function resolveAuthenticatedUser(
  request: FastifyRequest,
  auth: AuthRuntime,
): Promise<AuthContext> {
  const user = await auth.authenticate(readSessionToken(request));
  return { userId: user.id, user };
}
