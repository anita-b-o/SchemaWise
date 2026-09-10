// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface VercelConfig {
  rewrites: Array<{ source: string; destination: string }>;
}

const webRoot = fileURLToPath(new URL("../../", import.meta.url));
const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as VercelConfig;

function destinationFor(url: string): string | undefined {
  const pathname = new URL(url, "https://schemawise.vercel.app").pathname;
  return config.rewrites.find(({ source }) => new RegExp(`^${source}$`).test(pathname))?.destination;
}

describe("Vercel proxy routing", () => {
  it.each([
    "/api/v1/analysis",
    "/api/v1/auth/me",
    "/api/v1/projects?limit=20&offset=0",
  ])("routes %s to the single proxy Function", (url) => {
    expect(destinationFor(url)).toBe("/api/proxy");
  });

  it("does not add a named route parameter that could alter the original query", () => {
    expect(config.rewrites).toEqual([
      { source: "/api/v1/(.*)", destination: "/api/proxy" },
    ]);
  });

  it("keeps only the intended entrypoint under api", () => {
    const entries = readdirSync(`${webRoot}api`, { recursive: true })
      .filter((entry) => /\.[cm]?[jt]sx?$/.test(entry))
      .sort();

    expect(entries).toEqual(["proxy.ts"]);
  });
});
