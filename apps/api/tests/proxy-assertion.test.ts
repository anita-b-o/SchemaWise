import { describe, expect, it } from "vitest";
import {
  PROXY_ASSERTION_TTL_SECONDS,
  ProxyAssertionError,
  canonicalizeClientIp,
  createProxyAssertion,
  proxyAssertionMaterial,
  verifyProxyAssertion,
} from "@schemawise/proxy-assertion";

const SECRET = "proxy-assertion-test-secret-with-32-bytes";
const OTHER_SECRET = "other-proxy-test-secret-with-32-bytes";
const NOW = 1_789_000_000;
const base = {
  method: "POST",
  pathAndQuery: "/api/v1/auth/login?source=test",
  clientIp: "198.51.100.20",
};

function assertion(overrides: Partial<typeof base & { nowSeconds: number }> = {}) {
  return createProxyAssertion({ ...base, nowSeconds: NOW, ...overrides, secret: SECRET });
}

function verify(overrides: Partial<Parameters<typeof verifyProxyAssertion>[0]> = {}) {
  const signed = assertion();
  return verifyProxyAssertion({ ...base, ...signed, secret: SECRET, nowSeconds: NOW, ...overrides });
}

describe("staging proxy assertion protocol", () => {
  it("accepts a valid request-bound assertion and defines stable v1 material", () => {
    const signed = assertion();
    expect(verify()).toBe("198.51.100.20");
    expect(proxyAssertionMaterial({ ...base, timestamp: NOW })).toBe(
      `schemawise:proxy-ip:v1\n${NOW}\nPOST\n/api/v1/auth/login?source=test\n198.51.100.20`,
    );
    expect(signed.signature).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it.each([
    ["wrong secret", { secret: OTHER_SECRET }],
    ["modified IP", { clientIp: "198.51.100.21" }],
    ["modified method", { method: "PUT" }],
    ["modified path", { pathAndQuery: "/api/v1/auth/register?source=test" }],
    ["modified query", { pathAndQuery: "/api/v1/auth/login?source=other" }],
  ])("rejects %s", (_label, overrides) => {
    expect(() => verify(overrides)).toThrow(ProxyAssertionError);
  });

  it("rejects expired and future assertions outside the symmetric 60-second window", () => {
    expect(PROXY_ASSERTION_TTL_SECONDS).toBe(60);
    expect(() => verify({ nowSeconds: NOW + 61 })).toThrow(ProxyAssertionError);
    expect(() => verify({ nowSeconds: NOW - 61 })).toThrow(ProxyAssertionError);
    expect(() => verify({ nowSeconds: NOW + 60 })).not.toThrow();
    expect(() => verify({ nowSeconds: NOW - 60 })).not.toThrow();
  });

  it.each([
    ["malformed signature", { signature: "not-base64url" }],
    ["short same-alphabet signature", { signature: "A".repeat(42) }],
    ["malformed timestamp", { timestamp: "1.5" }],
    ["signed-header list", { clientIp: ["198.51.100.20", "198.51.100.21"] }],
    ["missing IP", { clientIp: undefined }],
    ["missing timestamp", { timestamp: undefined }],
    ["missing signature", { signature: undefined }],
  ])("rejects %s", (_label, overrides) => {
    expect(() => verify(overrides)).toThrow(ProxyAssertionError);
  });

  it("takes the equal-length timing-safe comparison path for a well-formed bad signature", () => {
    const signed = assertion();
    const replacement = signed.signature.endsWith("A") ? "B" : "A";
    expect(() => verify({ signature: `${signed.signature.slice(0, -1)}${replacement}` })).toThrow(ProxyAssertionError);
  });
});

describe("proxy client IP canonicalization", () => {
  it("canonicalizes IPv4, mapped IPv4, and IPv6 /64 exactly once for signing and limits", () => {
    expect(canonicalizeClientIp("198.51.100.20")).toBe("198.51.100.20");
    expect(canonicalizeClientIp("::ffff:192.0.2.128")).toBe("192.0.2.128");
    expect(canonicalizeClientIp("2001:0db8:1234:5678:abcd::2")).toBe("2001:db8:1234:5678::");
    const signed = assertion({ clientIp: "2001:db8:1234:5678::99" });
    expect(signed.clientIp).toBe("2001:db8:1234:5678::");
  });

  it.each(["not-an-ip", "198.51.100.2, 203.0.113.4", " 198.51.100.2 ", "198.51.100.2 "])(
    "rejects malformed, listed, or whitespace-bearing identity %s",
    (candidate) => expect(() => canonicalizeClientIp(candidate)).toThrow(ProxyAssertionError),
  );
});
