import argon2 from "argon2";
import type { PasswordHasher } from "../ports/password-hasher.js";

export const ARGON2ID_PARAMETERS = Object.freeze({
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
});

// Generated from a non-user sentinel with ARGON2ID_PARAMETERS. Keeping one
// valid PHC value avoids performing a fresh hash on every unknown-email login.
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=1,t=3$VIVtLSHiBwW71HdMuGxP7g$7rUIm17dmBTOUDkHse0T3Tg9z1pkkiOCfL+xUqWQBX0";

const SUPPORTED_PHC_PATTERN = /^\$argon2id\$v=19\$m=65536,p=1,t=3\$[^$]+\$[^$]+$/;

function assertSupportedHash(hash: string): void {
  if (!SUPPORTED_PHC_PATTERN.test(hash)) throw new Error("Unsupported password hash");
}

export class Argon2idPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id, ...ARGON2ID_PARAMETERS });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    assertSupportedHash(hash);
    return argon2.verify(hash, password);
  }

  async dummyVerify(password: string): Promise<void> {
    await argon2.verify(DUMMY_PASSWORD_HASH, password);
  }
}
