import { randomUUID } from "node:crypto";
import { authError, authInternalError, isAuthApplicationError } from "../errors/auth-error.js";
import type { AuthenticatedSession, AuthenticatedSessionContext } from "../model/authenticated-session.js";
import type { Session } from "../model/session.js";
import { toPublicUser, type PublicUser, type User } from "../model/user.js";
import type { AuthRegistrationRepository } from "../ports/auth-registration-repository.js";
import type { Clock } from "../ports/clock.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { SessionRepository } from "../ports/session-repository.js";
import type { SessionTokenGenerator } from "../ports/session-token-generator.js";
import type { UserRepository } from "../ports/user-repository.js";
import { normalizeEmail } from "../validation/email.js";
import { validateLoginPassword, validateRegistrationPassword } from "../validation/password.js";
import { isStructurallyValidSessionToken } from "../validation/session-token.js";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;

export interface RegisterUserInput {
  readonly email: unknown;
  readonly password: unknown;
}

export interface LoginUserInput {
  readonly email: unknown;
  readonly password: unknown;
}

export interface RegisterUserDependencies {
  readonly registrationRepository: AuthRegistrationRepository;
  readonly passwordHasher: PasswordHasher;
  readonly sessionTokenGenerator: SessionTokenGenerator;
  readonly clock: Clock;
}

export interface LoginUserDependencies {
  readonly userRepository: UserRepository;
  readonly sessionRepository: SessionRepository;
  readonly passwordHasher: PasswordHasher;
  readonly sessionTokenGenerator: SessionTokenGenerator;
  readonly clock: Clock;
}

export interface SessionAuthDependencies {
  readonly userRepository: UserRepository;
  readonly sessionRepository: SessionRepository;
  readonly sessionTokenGenerator: SessionTokenGenerator;
  readonly clock: Clock;
}

export interface LogoutDependencies {
  readonly sessionRepository: SessionRepository;
  readonly sessionTokenGenerator: SessionTokenGenerator;
}

function authenticated(user: User, session: Session, rawToken: string): AuthenticatedSession {
  return {
    user: toPublicUser(user),
    session: { id: session.id, token: rawToken, expiresAt: session.expiresAt },
  };
}

async function protect<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isAuthApplicationError(error)) throw error;
    throw authInternalError();
  }
}

function newSession(userId: string, tokenHash: string, createdAt: Date): Session {
  return {
    id: randomUUID(),
    userId,
    tokenHash,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + SESSION_LIFETIME_MS),
  };
}

export async function registerUser(
  dependencies: RegisterUserDependencies,
  input: RegisterUserInput,
): Promise<AuthenticatedSession> {
  const email = normalizeEmail(input.email);
  const password = validateRegistrationPassword(input.password);

  return protect(async () => {
    const now = dependencies.clock.now();
    const [passwordHash, generatedToken] = await Promise.all([
      dependencies.passwordHasher.hash(password),
      dependencies.sessionTokenGenerator.generate(),
    ]);
    const user: User = { id: randomUUID(), email, passwordHash, createdAt: now, updatedAt: now };
    const session = newSession(user.id, generatedToken.tokenHash, now);
    const result = await dependencies.registrationRepository.createUserWithSession(user, session);
    if (result.kind === "duplicate-email") {
      throw authError("EMAIL_ALREADY_EXISTS", "An account already exists for that email address.");
    }
    return authenticated(user, session, generatedToken.rawToken);
  });
}

export async function loginUser(
  dependencies: LoginUserDependencies,
  input: LoginUserInput,
): Promise<AuthenticatedSession> {
  const email = normalizeEmail(input.email);
  const password = validateLoginPassword(input.password);

  return protect(async () => {
    const user = await dependencies.userRepository.findByCanonicalEmail(email);
    if (user === null) {
      await dependencies.passwordHasher.dummyVerify(password);
      throw authError("INVALID_CREDENTIALS", "The email or password is incorrect.");
    }

    if (!(await dependencies.passwordHasher.verify(user.passwordHash, password))) {
      throw authError("INVALID_CREDENTIALS", "The email or password is incorrect.");
    }

    const now = dependencies.clock.now();
    const generatedToken = await dependencies.sessionTokenGenerator.generate();
    const session = newSession(user.id, generatedToken.tokenHash, now);
    await dependencies.sessionRepository.create(session);
    return authenticated(user, session, generatedToken.rawToken);
  });
}

export async function authenticateSession(
  dependencies: SessionAuthDependencies,
  rawToken: unknown,
): Promise<AuthenticatedSessionContext> {
  if (!isStructurallyValidSessionToken(rawToken)) {
    throw authError("UNAUTHENTICATED", "Authentication is required.");
  }

  return protect(async () => {
    const tokenHash = await dependencies.sessionTokenGenerator.hash(rawToken);
    const session = await dependencies.sessionRepository.findActiveByTokenHash(tokenHash, dependencies.clock.now());
    if (session === null) throw authError("UNAUTHENTICATED", "Authentication is required.");
    const user = await dependencies.userRepository.findById(session.userId);
    if (user === null) throw authError("UNAUTHENTICATED", "Authentication is required.");
    return { user: toPublicUser(user), sessionId: session.id };
  });
}

export async function logout(dependencies: LogoutDependencies, rawToken: unknown): Promise<void> {
  if (!isStructurallyValidSessionToken(rawToken)) return;
  await protect(async () => {
    const tokenHash = await dependencies.sessionTokenGenerator.hash(rawToken);
    await dependencies.sessionRepository.deleteByTokenHash(tokenHash);
  });
}
