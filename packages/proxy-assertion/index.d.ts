export const PROXY_ASSERTION_HEADERS: Readonly<{
  ip: "x-schemawise-proxy-ip";
  timestamp: "x-schemawise-proxy-timestamp";
  signature: "x-schemawise-proxy-signature";
}>;
export const PROXY_ASSERTION_TTL_SECONDS: 60;
export const MINIMUM_PROXY_SECRET_BYTES: 32;
export type ProxyAssertionErrorReason = "invalid-ip" | "invalid-timestamp" | "invalid-signature" | "future" | "expired" | "signature-mismatch" | "invalid-method" | "invalid-target";
export class ProxyAssertionError extends Error {
  readonly reason: ProxyAssertionErrorReason;
  constructor(reason: ProxyAssertionErrorReason);
}
export interface ProxyAssertionInput {
  readonly method: string;
  readonly pathAndQuery: string;
  readonly clientIp: string;
  readonly timestamp: number;
}
export function validateProxySecret(secret: unknown): string;
export function canonicalizeClientIp(candidate: unknown): string;
export function proxyAssertionMaterial(input: ProxyAssertionInput): string;
export function signProxyAssertion(input: ProxyAssertionInput, secret: string): string;
export function createProxyAssertion(input: Omit<ProxyAssertionInput, "timestamp"> & { readonly secret: string; readonly nowSeconds?: number }): {
  readonly clientIp: string;
  readonly timestamp: string;
  readonly signature: string;
};
export function verifyProxyAssertion(input: {
  readonly method: string;
  readonly pathAndQuery: string;
  readonly clientIp: unknown;
  readonly timestamp: unknown;
  readonly signature: unknown;
  readonly secret: string;
  readonly nowSeconds?: number;
}): string;
