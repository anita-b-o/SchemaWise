import { describe, expect, it } from "vitest";
import { demoFixtureIds, demoFixtures, draftForDemoSelection, sameDemoDraft } from "./demo-fixtures";

describe("Demo example fixtures", () => {
  it("provides the four documented, input-only templates with stable IDs and order", () => {
    expect(demoFixtureIds).toEqual(["basic-normalization", "composite-key", "third-normal-form-vs-bcnf", "enrollment"]);
    expect(demoFixtures["basic-normalization"].draft.functionalDependencies).toEqual([
      { left: ["demo-basic-a"], right: ["demo-basic-b"] },
      { left: ["demo-basic-b"], right: ["demo-basic-c"] },
    ]);
    expect(demoFixtures.enrollment.draft.attributes).toEqual([
      { id: "d", name: "Student" }, { id: "c", name: "Course" }, { id: "a", name: "Professor" },
      { id: "b", name: "Department" }, { id: "e", name: "Grade" }, { id: "f", name: "Office" },
    ]);
    expect(demoFixtures.enrollment.draft.functionalDependencies).toEqual([
      { left: ["d", "c"], right: ["e"] }, { left: ["c"], right: ["a"] }, { left: ["a"], right: ["b"] },
      { left: ["a"], right: ["f"] }, { left: ["b"], right: ["f"] },
    ]);
    expect(Object.isFrozen(demoFixtures)).toBe(true);
    expect(Object.isFrozen(demoFixtures.enrollment.draft.attributes)).toBe(true);
  });

  it("clones every draft and compares only ordered editable input", () => {
    const first = draftForDemoSelection("enrollment");
    const second = draftForDemoSelection("enrollment");
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.attributes).not.toBe(second.attributes);
    (first.attributes as { id: string; name: string }[])[0]!.name = "Changed";
    (first.functionalDependencies[0]!.left as string[]).push("a");
    expect(demoFixtures.enrollment.draft.attributes[0]?.name).toBe("Student");
    expect(demoFixtures.enrollment.draft.functionalDependencies[0]?.left).toEqual(["d", "c"]);
    expect(sameDemoDraft(first, second)).toBe(false);
    expect(draftForDemoSelection("blank")).toEqual({ relationName: "", attributes: [], functionalDependencies: [] });
  });
});
