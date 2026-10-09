import type { SchemaDraft } from "../workspace/workspace-reducer";

export type DemoFixtureId = "basic-normalization" | "composite-key" | "third-normal-form-vs-bcnf" | "enrollment";
export type DemoSelection = DemoFixtureId | "blank";

export interface DemoFixture {
  readonly id: DemoFixtureId;
  readonly name: string;
  readonly description: string;
  readonly difficulty: "Introductory" | "Intermediate" | "Advanced";
  readonly draft: SchemaDraft;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(freeze);
  }
  return value;
}

/** Input-only, deterministic templates. Mathematical results always come from the API. */
export const demoFixtures = freeze({
  "basic-normalization": {
    id: "basic-normalization",
    name: "Basic normalization",
    description: "See how a transitive dependency can leave a relation in 2NF while still violating 3NF and BCNF.",
    difficulty: "Introductory",
    draft: {
      relationName: "R",
      attributes: [
        { id: "demo-basic-a", name: "A" },
        { id: "demo-basic-b", name: "B" },
        { id: "demo-basic-c", name: "C" },
      ],
      functionalDependencies: [
        { left: ["demo-basic-a"], right: ["demo-basic-b"] },
        { left: ["demo-basic-b"], right: ["demo-basic-c"] },
      ],
    },
  },
  "composite-key": {
    id: "composite-key",
    name: "Composite key",
    description: "Explore how a dependency on part of a composite key creates a partial dependency and a 2NF problem.",
    difficulty: "Intermediate",
    draft: {
      relationName: "R",
      attributes: [
        { id: "demo-composite-a", name: "A" },
        { id: "demo-composite-b", name: "B" },
        { id: "demo-composite-c", name: "C" },
      ],
      functionalDependencies: [{ left: ["demo-composite-a"], right: ["demo-composite-c"] }],
    },
  },
  "third-normal-form-vs-bcnf": {
    id: "third-normal-form-vs-bcnf",
    name: "3NF versus BCNF",
    description: "Compare a relation that satisfies 3NF with one that still has a stricter BCNF violation.",
    difficulty: "Advanced",
    draft: {
      relationName: "R",
      attributes: [
        { id: "demo-3nf-a", name: "A" },
        { id: "demo-3nf-b", name: "B" },
        { id: "demo-3nf-c", name: "C" },
      ],
      functionalDependencies: [
        { left: ["demo-3nf-a", "demo-3nf-b"], right: ["demo-3nf-c"] },
        { left: ["demo-3nf-c"], right: ["demo-3nf-b"] },
      ],
    },
  },
  enrollment: {
    id: "enrollment",
    name: "Enrollment",
    description: "Work through a realistic enrollment relation with several dependencies and compare synthesis with BCNF decomposition.",
    difficulty: "Advanced",
    draft: {
      relationName: "Enrollment",
      attributes: [
        { id: "d", name: "Student" },
        { id: "c", name: "Course" },
        { id: "a", name: "Professor" },
        { id: "b", name: "Department" },
        { id: "e", name: "Grade" },
        { id: "f", name: "Office" },
      ],
      functionalDependencies: [
        { left: ["d", "c"], right: ["e"] },
        { left: ["c"], right: ["a"] },
        { left: ["a"], right: ["b"] },
        { left: ["a"], right: ["f"] },
        { left: ["b"], right: ["f"] },
      ],
    },
  },
} satisfies Record<DemoFixtureId, DemoFixture>);

export const demoFixtureIds: readonly DemoFixtureId[] = ["basic-normalization", "composite-key", "third-normal-form-vs-bcnf", "enrollment"];

export function draftForDemoSelection(selection: DemoSelection): SchemaDraft {
  if (selection === "blank") return { relationName: "", attributes: [], functionalDependencies: [] };
  const draft = demoFixtures[selection].draft;
  return {
    relationName: draft.relationName,
    attributes: draft.attributes.map((attribute) => ({ ...attribute })),
    functionalDependencies: draft.functionalDependencies.map((dependency) => ({ left: [...dependency.left], right: [...dependency.right] })),
  };
}

/** Compares the editable input only; revisions, snapshots, requests, and UI do not affect Demo dirty state. */
export function sameDemoDraft(left: SchemaDraft, right: SchemaDraft): boolean {
  return left.relationName === right.relationName
    && left.attributes.length === right.attributes.length
    && left.attributes.every((attribute, index) => attribute.id === right.attributes[index]?.id && attribute.name === right.attributes[index]?.name)
    && left.functionalDependencies.length === right.functionalDependencies.length
    && left.functionalDependencies.every((dependency, index) => dependency.left.length === right.functionalDependencies[index]?.left.length
      && dependency.right.length === right.functionalDependencies[index]?.right.length
      && dependency.left.every((id, idIndex) => id === right.functionalDependencies[index]?.left[idIndex])
      && dependency.right.every((id, idIndex) => id === right.functionalDependencies[index]?.right[idIndex]));
}
