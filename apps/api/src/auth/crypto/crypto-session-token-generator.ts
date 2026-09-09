import { createHash, randomBytes } from "node:crypto";
import type { SessionTokenGenerator, GeneratedSessionToken } from "../ports/session-token-generator.js";
import type { SessionTokenHash } from "../model/session.js";

const TOKEN_BYTES = 32;

export class CryptoSessionTokenGenerator implements SessionTokenGenerator {
  async generate(): Promise<GeneratedSessionToken> {
    const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
    return { rawToken, tokenHash: await this.hash(rawToken) };
  }

  async hash(rawToken: string): Promise<SessionTokenHash> {
    return createHash("sha256").update(rawToken, "utf8").digest("hex");
  }
}
