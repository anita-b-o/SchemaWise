// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { PROXY_ASSERTION_HEADERS, verifyProxyAssertion } from "@schemawise/proxy-assertion";
import { createProxyHandler, readRenderApiOrigin, relayResponseHeaders } from "./_proxy-core.js";

const SECRET = "web-proxy-test-secret-with-at-least-32-bytes";
const NOW = 1_789_000_000;
const LOCAL_ENV = {
  RENDER_API_ORIGIN: "http://127.0.0.1:3400",
  STAGING_PROXY_SECRET: SECRET,
};

describe("Vercel API proxy", () => {
  it("validates a fixed origin without credentials, path, or insecure hosted transport", () => {
    expect(readRenderApiOrigin("https://api.example.test/", { VERCEL_ENV: "preview" })).toBe("https://api.example.test");
    for (const value of [
      "https://user:pass@api.example.test",
      "https://api.example.test/path",
      "https://api.example.test/?query=1",
      "https://api.example.test/#fragment",
      "http://api.example.test",
    ]) {
      expect(() => readRenderApiOrigin(value, { VERCEL_ENV: "production" })).toThrow("RENDER_API_ORIGIN");
    }
    expect(() => readRenderApiOrigin("http://api.example.test", {})).toThrow("HTTPS");
    expect(readRenderApiOrigin("http://localhost:3000", {})).toBe("http://localhost:3000");
  });

  it("preserves URL, query, method, body and browser security headers while replacing spoofed assertions", async () => {
    let target = "";
    let init: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, requestInit) => {
      target = String(input);
      init = requestInit;
      return Response.json({ ok: true }, { status: 201 });
    };
    const handler = createProxyHandler({ environment: LOCAL_ENV, fetchImpl, nowSeconds: () => NOW });
    const request = new Request("https://schemawise.vercel.app/api/v1/projects?limit=2&offset=1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        origin: "https://schemawise.vercel.app",
        referer: "https://schemawise.vercel.app/projects",
        cookie: "schemawise_session=secret-cookie",
        "x-csrf-token": "secret-csrf",
        "x-vercel-forwarded-for": "::ffff:198.51.100.20",
        "x-schemawise-proxy-ip": "203.0.113.99",
        "x-schemawise-proxy-timestamp": "1",
        "x-schemawise-proxy-signature": "A".repeat(43),
        host: "schemawise.vercel.app",
        connection: "keep-alive",
      },
      body: JSON.stringify({ name: "relay" }),
    });

    const response = await handler(request);
    expect(response.status).toBe(201);
    expect(target).toBe("http://127.0.0.1:3400/api/v1/projects?limit=2&offset=1");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Headers;
    expect(headers.get("origin")).toBe("https://schemawise.vercel.app");
    expect(headers.get("referer")).toBe("https://schemawise.vercel.app/projects");
    expect(headers.get("cookie")).toBe("schemawise_session=secret-cookie");
    expect(headers.get("x-csrf-token")).toBe("secret-csrf");
    expect(headers.get("host")).toBeNull();
    expect(headers.get("connection")).toBeNull();
    expect(headers.get("x-vercel-forwarded-for")).toBeNull();
    expect(headers.get(PROXY_ASSERTION_HEADERS.ip)).toBe("198.51.100.20");
    expect(headers.get(PROXY_ASSERTION_HEADERS.signature)).not.toBe("A".repeat(43));
    expect(verifyProxyAssertion({
      method: "POST",
      pathAndQuery: "/api/v1/projects?limit=2&offset=1",
      clientIp: headers.get(PROXY_ASSERTION_HEADERS.ip),
      timestamp: headers.get(PROXY_ASSERTION_HEADERS.timestamp),
      signature: headers.get(PROXY_ASSERTION_HEADERS.signature),
      secret: SECRET,
      nowSeconds: NOW,
    })).toBe("198.51.100.20");
    expect(Buffer.from(init?.body as ArrayBuffer).toString("utf8")).toBe(JSON.stringify({ name: "relay" }));
  });

  it("preserves status, body, Retry-After, content metadata, and independent Set-Cookie fields", async () => {
    const upstreamHeaders = new Headers({
      "content-type": "application/json",
      "cache-control": "no-store",
      "retry-after": "42",
      location: "/api/v1/auth/me",
      connection: "close",
      "content-encoding": "gzip",
    });
    upstreamHeaders.append("set-cookie", "schemawise_session=abc; Path=/; HttpOnly; Secure; SameSite=Lax");
    upstreamHeaders.append("set-cookie", "secondary=def; Path=/; HttpOnly; Secure; SameSite=Lax");
    const fetchImpl: typeof fetch = async () => new Response('{"error":"limited"}', { status: 429, headers: upstreamHeaders });
    const handler = createProxyHandler({ environment: LOCAL_ENV, fetchImpl, nowSeconds: () => NOW });
    const response = await handler(new Request("https://schemawise.vercel.app/api/v1/auth/login", {
      method: "POST",
      headers: { "x-vercel-forwarded-for": "198.51.100.20" },
      body: "{}",
    }));
    expect(response.status).toBe(429);
    expect(await response.text()).toBe('{"error":"limited"}');
    expect(response.headers.get("retry-after")).toBe("42");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("location")).toBe("/api/v1/auth/me");
    expect(response.headers.get("connection")).toBeNull();
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.getSetCookie()).toEqual([
      "schemawise_session=abc; Path=/; HttpOnly; Secure; SameSite=Lax",
      "secondary=def; Path=/; HttpOnly; Secure; SameSite=Lax",
    ]);
  });

  it("relays multiple Set-Cookie values without comma splitting or attribute rewriting", () => {
    const source = new Headers();
    source.append("set-cookie", "a=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/");
    source.append("set-cookie", "b=2; Path=/; HttpOnly");
    expect(relayResponseHeaders(source).getSetCookie()).toEqual(source.getSetCookie());
  });

  it("preserves a 204 as bodyless and does not force a success/error status", async () => {
    const handler = createProxyHandler({ environment: LOCAL_ENV, fetchImpl: async () => new Response(null, { status: 204 }), nowSeconds: () => NOW });
    const response = await handler(new Request("https://schemawise.vercel.app/api/v1/auth/logout", {
      method: "POST",
      headers: { "x-vercel-forwarded-for": "198.51.100.20" },
    }));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it.each([400, 413, 503])("preserves upstream status %s", async (status) => {
    const handler = createProxyHandler({ environment: LOCAL_ENV, fetchImpl: async () => new Response("upstream", { status }), nowSeconds: () => NOW });
    const response = await handler(new Request("https://schemawise.vercel.app/api/v1/analysis", { headers: { "x-vercel-forwarded-for": "198.51.100.20" } }));
    expect(response.status).toBe(status);
    expect(await response.text()).toBe("upstream");
  });

  it("sanitizes upstream failures without retrying or exposing secret, IP, cookie, or body", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => { throw new Error(`upstream failed ${SECRET}`); });
    const handler = createProxyHandler({ environment: LOCAL_ENV, fetchImpl, nowSeconds: () => NOW });
    const response = await handler(new Request("https://schemawise.vercel.app/api/v1/analysis", {
      method: "POST",
      headers: { "x-vercel-forwarded-for": "198.51.100.20", cookie: "private-cookie" },
      body: "private-body",
    }));
    expect(response.status).toBe(502);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const body = await response.text();
    for (const sensitive of [SECRET, "198.51.100.20", "private-cookie", "private-body", "signature"]) {
      expect(body).not.toContain(sensitive);
    }
  });

  it.each([undefined, "not-an-ip", "198.51.100.1, 198.51.100.2"])(
    "rejects missing or non-singular trusted Vercel identity %s",
    async (clientIp) => {
      const fetchImpl = vi.fn<typeof fetch>();
      const handler = createProxyHandler({ environment: LOCAL_ENV, fetchImpl, nowSeconds: () => NOW });
      const headers = clientIp === undefined ? {} : { "x-vercel-forwarded-for": clientIp };
      const response = await handler(new Request("https://schemawise.vercel.app/api/v1/analysis", { headers }));
      expect(response.status).toBe(403);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});
