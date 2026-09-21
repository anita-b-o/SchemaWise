import { describe, expect, it } from "vitest";
import { workspaceResourceIdentity } from "../projects/workspace-resource-identity";
import { parseWorkspaceView, setWorkspaceView } from "./workspace-view";

describe("workspace URL identity", () => {
  it("defaults omitted, schema, and unknown view values to Schema", () => {
    for (const search of ["", "view=schema", "view=foo", "view=ANALYSIS"]) {
      expect(parseWorkspaceView(new URLSearchParams(search))).toBe("schema");
    }
    expect(parseWorkspaceView(new URLSearchParams("view=analysis"))).toBe("analysis");
    expect(parseWorkspaceView(new URLSearchParams("view=transform"))).toBe("transform");
  });

  it("changes only the view parameter and omits Schema from the canonical URL", () => {
    const source = new URLSearchParams("campaign=abc&view=foo&debug=1");
    expect(setWorkspaceView(source, "analysis").toString()).toBe("campaign=abc&view=analysis&debug=1");
    expect(setWorkspaceView(source, "schema").toString()).toBe("campaign=abc&debug=1");
    expect(source.get("view")).toBe("foo");
  });

  it("identifies resources from pathname alone", () => {
    expect(workspaceResourceIdentity("/")).toBe("ROOT WORKSPACE");
    expect(workspaceResourceIdentity("/projects/ABC")).toBe("PROJECT:abc");
    expect(workspaceResourceIdentity("/projects/ABC")).not.toBe(workspaceResourceIdentity("/projects/DEF"));
  });
});
