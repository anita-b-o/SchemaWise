import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Argon2idPasswordHasher, CryptoSessionTokenGenerator } from "../src/index.js";

describe("Argon2idPasswordHasher", () => {
  const hasher = new Argon2idPasswordHasher();

  it("hashes and verifies without retaining plaintext", async () => {
    const password = "  correct horse batería 🔐  ";
    const hash = await hasher.hash(password);
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,p=1,t=3\$/);
    expect(hash).not.toContain(password);
    await expect(hasher.verify(hash, password)).resolves.toBe(true);
    await expect(hasher.verify(hash, password.trim())).resolves.toBe(false);
    await expect(hasher.verify(hash, "incorrect password")).resolves.toBe(false);
  });

  it("uses a fresh random salt for every hash", async () => {
    const first = await hasher.hash("same Unicode contraseña");
    const second = await hasher.hash("same Unicode contraseña");
    expect(first).not.toBe(second);
    await expect(hasher.verify(second, "same Unicode contraseña")).resolves.toBe(true);
  });

  it("performs a real dummy verification and safely rejects malformed PHC input", async () => {
    await expect(hasher.dummyVerify("any supplied password")).resolves.toBeUndefined();
    await expect(hasher.verify("not-a-phc-hash", "password")).rejects.toThrow();
  });
});

describe("CryptoSessionTokenGenerator", () => {
  const generator = new CryptoSessionTokenGenerator();

  it("generates 32 random bytes as unpadded base64url", async () => {
    const first = await generator.generate();
    const second = await generator.generate();
    expect(first.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.rawToken).not.toContain("=");
    expect(Buffer.from(first.rawToken, "base64url")).toHaveLength(32);
    expect(second.rawToken).not.toBe(first.rawToken);
  });

  it("hashes tokens deterministically as lowercase SHA-256 hex", async () => {
    const rawToken = (await generator.generate()).rawToken;
    const expected = createHash("sha256").update(rawToken, "utf8").digest("hex");
    await expect(generator.hash(rawToken)).resolves.toBe(expected);
    await expect(generator.hash(rawToken)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });
});
