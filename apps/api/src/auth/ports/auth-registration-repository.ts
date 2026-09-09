import type { Session } from "../model/session.js";
import type { User } from "../model/user.js";

export type AuthRegistrationResult = { readonly kind: "created" } | { readonly kind: "duplicate-email" };

/**
 * Persists both records atomically. Implementations must leave neither record
 * committed if either insert fails.
 */
export interface AuthRegistrationRepository {
  createUserWithSession(user: User, session: Session): Promise<AuthRegistrationResult>;
}
