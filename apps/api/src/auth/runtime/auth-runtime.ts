import type { Pool } from "pg";
import {
  authenticateSession,
  loginUser,
  logout,
  registerUser,
  type LoginUserInput,
  type RegisterUserInput,
} from "../application/auth-use-cases.js";
import { Argon2idPasswordHasher } from "../crypto/argon2id-password-hasher.js";
import { CryptoSessionTokenGenerator } from "../crypto/crypto-session-token-generator.js";
import type { AuthenticatedSession } from "../model/authenticated-session.js";
import type { PublicUser } from "../model/user.js";
import type { AuthRegistrationRepository } from "../ports/auth-registration-repository.js";
import type { Clock } from "../ports/clock.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { SessionRepository } from "../ports/session-repository.js";
import type { SessionTokenGenerator } from "../ports/session-token-generator.js";
import type { UserRepository } from "../ports/user-repository.js";
import { PostgresAuthRegistrationRepository } from "../postgres/postgres-auth-registration-repository.js";
import { PostgresSessionRepository } from "../postgres/postgres-session-repository.js";
import { PostgresUserRepository } from "../postgres/postgres-user-repository.js";

export interface AuthRuntime {
  register(input: RegisterUserInput): Promise<AuthenticatedSession>;
  login(input: LoginUserInput): Promise<AuthenticatedSession>;
  authenticate(rawToken: unknown): Promise<PublicUser>;
  logout(rawToken: unknown): Promise<void>;
}

export interface AuthRuntimeDependencies {
  readonly registrationRepository: AuthRegistrationRepository;
  readonly userRepository: UserRepository;
  readonly sessionRepository: SessionRepository;
  readonly passwordHasher: PasswordHasher;
  readonly sessionTokenGenerator: SessionTokenGenerator;
  readonly clock: Clock;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export function createAuthRuntime(dependencies: AuthRuntimeDependencies): AuthRuntime {
  return {
    register: (input) => registerUser(dependencies, input),
    login: (input) => loginUser(dependencies, input),
    authenticate: (rawToken) => authenticateSession(dependencies, rawToken),
    logout: (rawToken) => logout(dependencies, rawToken),
  };
}

/** Builds one auth composition around the caller-owned, shared PostgreSQL pool. */
export function createPostgresAuthRuntime(pool: Pool): AuthRuntime {
  const userRepository = new PostgresUserRepository(pool);
  const sessionRepository = new PostgresSessionRepository(pool);
  return createAuthRuntime({
    registrationRepository: new PostgresAuthRegistrationRepository(pool),
    userRepository,
    sessionRepository,
    passwordHasher: new Argon2idPasswordHasher(),
    sessionTokenGenerator: new CryptoSessionTokenGenerator(),
    clock: new SystemClock(),
  });
}
