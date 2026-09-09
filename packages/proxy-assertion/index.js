import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { Address6 } from "ip-address";

export const PROXY_ASSERTION_HEADERS = Object.freeze({
  ip: "x-schemawise-proxy-ip",
  timestamp: "x-schemawise-proxy-timestamp",
  signature: "x-schemawise-proxy-signature",
});

export const PROXY_ASSERTION_TTL_SECONDS = 60;
export const MINIMUM_PROXY_SECRET_BYTES = 32;
const SIGNING_DOMAIN = "schemawise:proxy-ip:v1\n";
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TIMESTAMP_PATTERN = /^(?:0|[1-9][0-9]{0,10})$/;

export class ProxyAssertionError extends Error {
  constructor(reason) {
    super("The proxy assertion is invalid.");
    this.name = "ProxyAssertionError";
    this.reason = reason;
  }
}

export function validateProxySecret(secret) {
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < MINIMUM_PROXY_SECRET_BYTES) {
    throw new Error("STAGING_PROXY_SECRET is required and must contain at least 32 bytes");
  }
  return secret;
}

export function canonicalizeClientIp(candidate) {
  if (typeof candidate !== "string" || candidate.trim() !== candidate || isIP(candidate) === 0) {
    throw new ProxyAssertionError("invalid-ip");
  }
  if (isIP(candidate) === 4) return candidate.toLowerCase();

  const address = new Address6(candidate);
  if (address.isMapped4()) return address.to4().correctForm();
  return new Address6(`${candidate}/64`).startAddress().correctForm();
}

export function proxyAssertionMaterial({ timestamp, method, pathAndQuery, clientIp }) {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new ProxyAssertionError("invalid-timestamp");
  const normalizedMethod = normalizeMethod(method);
  const normalizedTarget = normalizePathAndQuery(pathAndQuery);
  const canonicalIp = canonicalizeClientIp(clientIp);
  return `${SIGNING_DOMAIN}${timestamp}\n${normalizedMethod}\n${normalizedTarget}\n${canonicalIp}`;
}

export function signProxyAssertion(input, secret) {
  return createHmac("sha256", validateProxySecret(secret))
    .update(proxyAssertionMaterial(input), "utf8")
    .digest("base64url");
}

export function createProxyAssertion({ method, pathAndQuery, clientIp, secret, nowSeconds = Math.floor(Date.now() / 1000) }) {
  const canonicalIp = canonicalizeClientIp(clientIp);
  const timestamp = Math.floor(nowSeconds);
  const signature = signProxyAssertion({ timestamp, method, pathAndQuery, clientIp: canonicalIp }, secret);
  return { clientIp: canonicalIp, timestamp: String(timestamp), signature };
}

export function verifyProxyAssertion({ method, pathAndQuery, clientIp, timestamp, signature, secret, nowSeconds = Math.floor(Date.now() / 1000) }) {
  if (typeof timestamp !== "string" || !TIMESTAMP_PATTERN.test(timestamp)) {
    throw new ProxyAssertionError("invalid-timestamp");
  }
  if (typeof signature !== "string" || !SIGNATURE_PATTERN.test(signature)) {
    throw new ProxyAssertionError("invalid-signature");
  }
  const parsedTimestamp = Number(timestamp);
  if (!Number.isSafeInteger(parsedTimestamp)) throw new ProxyAssertionError("invalid-timestamp");
  if (!Number.isFinite(nowSeconds) || Math.abs(nowSeconds - parsedTimestamp) > PROXY_ASSERTION_TTL_SECONDS) {
    throw new ProxyAssertionError(parsedTimestamp > nowSeconds ? "future" : "expired");
  }

  const canonicalIp = canonicalizeClientIp(clientIp);
  const expected = Buffer.from(signProxyAssertion({ timestamp: parsedTimestamp, method, pathAndQuery, clientIp: canonicalIp }, secret), "base64url");
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new ProxyAssertionError("signature-mismatch");
  }
  return canonicalIp;
}

function normalizeMethod(method) {
  if (typeof method !== "string" || !/^[A-Za-z]+$/.test(method)) throw new ProxyAssertionError("invalid-method");
  return method.toUpperCase();
}

function normalizePathAndQuery(pathAndQuery) {
  if (typeof pathAndQuery !== "string" || !pathAndQuery.startsWith("/") || /[\r\n]/.test(pathAndQuery)) {
    throw new ProxyAssertionError("invalid-target");
  }
  return pathAndQuery;
}
