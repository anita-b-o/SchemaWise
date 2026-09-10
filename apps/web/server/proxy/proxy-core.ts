import {
  PROXY_ASSERTION_HEADERS,
  ProxyAssertionError,
  canonicalizeClientIp,
  createProxyAssertion,
  validateProxySecret,
} from "@schemawise/proxy-assertion";

const REQUEST_HEADERS_TO_REMOVE = new Set([
  "accept-encoding",
  "cf-connecting-ip",
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "x-forwarded-for",
  "x-real-ip",
  "x-vercel-forwarded-for",
  PROXY_ASSERTION_HEADERS.ip,
  PROXY_ASSERTION_HEADERS.timestamp,
  PROXY_ASSERTION_HEADERS.signature,
]);
const RESPONSE_HEADERS_TO_REMOVE = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export interface ProxyEnvironment {
  readonly RENDER_API_ORIGIN?: string;
  readonly STAGING_PROXY_SECRET?: string;
  readonly VERCEL_ENV?: string;
}

export interface ProxyHandlerOptions {
  readonly environment: ProxyEnvironment;
  readonly fetchImpl?: typeof fetch;
  readonly nowSeconds?: () => number;
}

export function readRenderApiOrigin(value: string | undefined, environment: ProxyEnvironment): string {
  if (value === undefined || value.length === 0) throw new Error("RENDER_API_ORIGIN is required");
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("RENDER_API_ORIGIN must be a valid origin"); }
  if (parsed.username !== "" || parsed.password !== "" || parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "") {
    throw new Error("RENDER_API_ORIGIN must be an origin without credentials, path, query, or fragment");
  }
  const hosted = environment.VERCEL_ENV === "preview" || environment.VERCEL_ENV === "production";
  const localHttp = parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1");
  if (parsed.protocol !== "https:" && !(localHttp && !hosted)) {
    throw new Error("RENDER_API_ORIGIN must use HTTPS outside local development");
  }
  return parsed.origin;
}

export function readTrustedVercelClientIp(request: Request): string {
  const value = request.headers.get("x-vercel-forwarded-for");
  try {
    return canonicalizeClientIp(value);
  } catch (error) {
    if (error instanceof ProxyAssertionError) throw new Error("Trusted Vercel client IP is missing or invalid");
    throw error;
  }
}

export function createProxyHandler(options: ProxyHandlerOptions): (request: Request) => Promise<Response> {
  const upstreamOrigin = readRenderApiOrigin(options.environment.RENDER_API_ORIGIN, options.environment);
  const secret = validateProxySecret(options.environment.STAGING_PROXY_SECRET);
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000));

  return async (request: Request): Promise<Response> => {
    const incomingUrl = new URL(request.url);
    if (!incomingUrl.pathname.startsWith("/api/v1/")) {
      return safeError(404, "PROXY_ROUTE_NOT_FOUND", "The requested proxy route does not exist.");
    }
    let clientIp: string;
    try {
      clientIp = readTrustedVercelClientIp(request);
    } catch {
      return safeError(403, "INVALID_PROXY_CLIENT", "Request client identity could not be verified.");
    }

    const pathAndQuery = `${incomingUrl.pathname}${incomingUrl.search}`;
    const assertion = createProxyAssertion({
      method: request.method,
      pathAndQuery,
      clientIp,
      secret,
      nowSeconds: nowSeconds(),
    });
    const headers = relayRequestHeaders(request.headers);
    headers.set(PROXY_ASSERTION_HEADERS.ip, assertion.clientIp);
    headers.set(PROXY_ASSERTION_HEADERS.timestamp, assertion.timestamp);
    headers.set(PROXY_ASSERTION_HEADERS.signature, assertion.signature);

    let upstream: Response;
    try {
      upstream = await fetchImpl(`${upstreamOrigin}${pathAndQuery}`, {
        method: request.method,
        headers,
        ...(request.method === "GET" || request.method === "HEAD" ? {} : { body: await request.arrayBuffer() }),
        redirect: "manual",
      });
    } catch {
      return safeError(502, "UPSTREAM_UNAVAILABLE", "The upstream API is unavailable.");
    }

    try {
      const responseHeaders = relayResponseHeaders(upstream.headers);
      const body = responseMayHaveBody(request.method, upstream.status) ? await upstream.arrayBuffer() : null;
      return new Response(body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
    } catch {
      return safeError(502, "UPSTREAM_UNAVAILABLE", "The upstream API is unavailable.");
    }
  };
}

export function relayRequestHeaders(source: Headers): Headers {
  const result = new Headers();
  source.forEach((value, name) => {
    if (!REQUEST_HEADERS_TO_REMOVE.has(name.toLowerCase())) result.append(name, value);
  });
  return result;
}

export function relayResponseHeaders(source: Headers): Headers {
  const result = new Headers();
  source.forEach((value, name) => {
    const normalized = name.toLowerCase();
    if (normalized !== "set-cookie" && !RESPONSE_HEADERS_TO_REMOVE.has(normalized)) result.append(name, value);
  });
  for (const cookie of source.getSetCookie()) result.append("set-cookie", cookie);
  return result;
}

function responseMayHaveBody(method: string, status: number): boolean {
  return method !== "HEAD" && status !== 204 && status !== 205 && status !== 304;
}

function safeError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}
