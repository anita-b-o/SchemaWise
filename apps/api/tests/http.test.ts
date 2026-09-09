import { describe, expect, it } from "vitest";
import { createServer } from "../src/index.js";
import type { SchemaAnalysisRequestDto } from "../src/index.js";

const schema: SchemaAnalysisRequestDto = {
  relation: { name: "R", attributes: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] },
  functionalDependencies: [{ left: ["a"], right: ["b"] }, { left: ["b"], right: ["c"] }],
};

async function withServer<T>(fn: (server: ReturnType<typeof createServer>) => Promise<T>): Promise<T> {
  const server = createServer();
  try { return await fn(server); } finally { await server.close(); }
}

function post(path: string, payload: unknown) {
  return { method: "POST" as const, url: path, headers: { "content-type": "application/json" }, payload: JSON.stringify(payload) };
}

describe("HTTP adapter v1", () => {
  it("handles preflight for an allowed origin without entering the application layer", async () => withServer(async (server) => {
    const response = await server.inject({
      method: "OPTIONS",
      url: "/api/v1/analysis",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-methods"]).toBe("GET, POST, OPTIONS");
    expect(response.headers["access-control-allow-headers"]).toBe("Content-Type, X-CSRF-Token");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-origin"]).not.toBe("*");
  }));

  it("serves analysis", async () => withServer(async (server) => {
    const response = await server.inject(post("/api/v1/analysis", schema));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ candidateKeys: [["a"]], normalForms: { second: { satisfied: true }, third: { satisfied: false }, bcnf: { satisfied: false } } });
  }));

  it("adds credentialed CORS headers to a successful browser request", async () => withServer(async (server) => {
    const response = await server.inject({
      ...post("/api/v1/analysis", schema),
      headers: { "content-type": "application/json", origin: "http://127.0.0.1:5174" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5174");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  }));

  it("does not authorize a disallowed origin", async () => withServer(async (server) => {
    const response = await server.inject({
      ...post("/api/v1/analysis", schema),
      headers: { "content-type": "application/json", origin: "https://not-allowed.example" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-allow-origin"]).not.toBe("*");
  }));

  it("keeps direct requests without Origin working", async () => withServer(async (server) => {
    const response = await server.inject(post("/api/v1/analysis", schema));
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  }));

  it("serves closure", async () => withServer(async (server) => {
    const response = await server.inject(post("/api/v1/closure", { ...schema, attributes: ["a"] }));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ closure: ["a", "b", "c"] });
  }));

  it("serves 3NF synthesis", async () => withServer(async (server) => {
    const response = await server.inject(post("/api/v1/synthesis/3nf", { ...schema, functionalDependencies: [{ left: ["a"], right: ["b"] }] }));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ addedCandidateKey: ["a", "c"], minimalCover: [{ left: ["a"], right: ["b"] }], relations: [{ attributes: ["a", "b"], source: "minimal-cover" }, { attributes: ["a", "c"], source: "candidate-key" }] });
  }));

  it("serves BCNF decomposition", async () => withServer(async (server) => {
    const response = await server.inject(post("/api/v1/decomposition/bcnf", schema));
    expect(response.statusCode).toBe(200);
    expect(response.json().steps[0]).toEqual({ source: ["a", "b", "c"], violation: { determinant: ["b"], dependent: "c" }, result: [["b", "c"], ["a", "b"]] });
  }));

  it("serves dependency preservation", async () => withServer(async (server) => {
    const response = await server.inject(post("/api/v1/analysis/dependency-preservation", { ...schema, decomposition: [["a", "b"], ["b", "c"]] }));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ preserved: true, preservedDependencies: schema.functionalDependencies, lostDependencies: [] });
  }));

  it("normalizes malformed JSON, media type, and oversized payloads", async () => withServer(async (server) => {
    const malformed = await server.inject({ method: "POST", url: "/api/v1/analysis", headers: { "content-type": "application/json" }, payload: "{" });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({ error: { code: "INVALID_REQUEST", message: "Request body contains invalid JSON." } });

    const mediaType = await server.inject({ method: "POST", url: "/api/v1/analysis", headers: { "content-type": "text/plain" }, payload: "{}" });
    expect(mediaType.statusCode).toBe(415);
    expect(mediaType.json().error.code).toBe("INVALID_REQUEST");

    const oversized = await server.inject({ method: "POST", url: "/api/v1/analysis", headers: { "content-type": "application/json" }, payload: `{"padding":"${"x".repeat(70_000)}"}` });
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json().error.code).toBe("ANALYSIS_LIMIT_EXCEEDED");
  }));

  it("maps application validation errors", async () => withServer(async (server) => {
    const sevenAttributes = { ...schema, relation: { ...schema.relation, attributes: Array.from({ length: 7 }, (_, index) => ({ id: String.fromCharCode(97 + index), name: String.fromCharCode(65 + index) })) } };
    const thirteenFds = { ...schema, functionalDependencies: Array.from({ length: 13 }, () => ({ left: ["a"], right: ["b"] })) };
    const unknownAttribute = { ...schema, functionalDependencies: [{ left: ["x"], right: ["a"] }] };
    const collision = { ...schema, relation: { ...schema.relation, attributes: [{ id: "a", name: "A" }, { id: "a", name: "Other" }] } };
    const incomplete = { ...schema, decomposition: [["a", "b"]] };
    for (const [payload, status, code] of [[sevenAttributes, 422, "ANALYSIS_LIMIT_EXCEEDED"], [thirteenFds, 422, "ANALYSIS_LIMIT_EXCEEDED"], [unknownAttribute, 400, "UNKNOWN_ATTRIBUTE_REFERENCE"], [collision, 400, "ATTRIBUTE_IDENTITY_COLLISION"], [incomplete, 400, "INCOMPLETE_DECOMPOSITION"]] as const) {
      const path = code === "INCOMPLETE_DECOMPOSITION" ? "/api/v1/analysis/dependency-preservation" : "/api/v1/analysis";
      const response = await server.inject(post(path, payload));
      expect(response.statusCode).toBe(status);
      expect(response.json().error.code).toBe(code);
    }
  }));

  it("returns a stable envelope for unknown routes and unexpected errors", async () => {
    const unknown = await withServer((server) => server.inject(post("/api/v1/missing", {})));
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toEqual({ error: { code: "INVALID_REQUEST", message: "The requested API route does not exist." } });

    const server = createServer({ useCases: { analyzeSchema: () => { throw new Error("secret stack details"); }, calculateClosure: () => ({}), synthesizeThirdNormalForm: () => ({}), decomposeBoyceCodd: () => ({}), analyzeDependencyPreservation: () => ({}) } });
    try {
      const response = await server.inject(post("/api/v1/analysis", schema));
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } });
      expect(response.body).not.toContain("secret stack details");
      expect(response.body).not.toContain("stack");
    } finally { await server.close(); }
  });

  it("keeps unknown API routes unchanged", async () => withServer(async (server) => {
    const getResponse = await server.inject({ method: "GET", url: "/api/v1/missing" });
    expect(getResponse.statusCode).toBe(404);
    expect(getResponse.json()).toEqual({ error: { code: "INVALID_REQUEST", message: "The requested API route does not exist." } });

    const postResponse = await server.inject({
      ...post("/api/v1/missing", {}),
      headers: { "content-type": "application/json", origin: "http://localhost:5173" },
    });
    expect(postResponse.statusCode).toBe(404);
    expect(postResponse.json()).toEqual({ error: { code: "INVALID_REQUEST", message: "The requested API route does not exist." } });
  }));

  it("preserves application canonical ordering for reordered input", async () => withServer(async (server) => {
    const reordered = { relation: { name: "R", attributes: [...schema.relation.attributes].reverse() }, functionalDependencies: [...schema.functionalDependencies].reverse() };
    const first = await server.inject(post("/api/v1/analysis", schema));
    const second = await server.inject(post("/api/v1/analysis", reordered));
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
  }));
});
