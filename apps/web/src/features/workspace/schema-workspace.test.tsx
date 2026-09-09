import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SchemaWorkspace } from "./components/SchemaWorkspace";

async function renderWorkspaceWithExample() {
  const user = userEvent.setup();
  render(<SchemaWorkspace />);
  await user.click(screen.getByRole("button", { name: "Load example" }));
  return user;
}

function side(name: "Determinant" | "Dependent") {
  return within(screen.getByRole("group", { name }));
}

describe("schema workspace input editor", () => {
  it("edits the relation name through its labeled input", async () => {
    const user = userEvent.setup();
    render(<SchemaWorkspace />);
    const input = screen.getByRole("textbox", { name: "Relation name" });
    await user.type(input, "Enrollment");
    expect((input as HTMLInputElement).value).toBe("Enrollment");
    expect((input as HTMLInputElement).maxLength).toBe(120);
  });

  it("adds, focuses, renames and directly removes an unreferenced attribute", async () => {
    const user = userEvent.setup();
    render(<SchemaWorkspace />);
    await user.click(screen.getByRole("button", { name: "Add attribute" }));
    const input = screen.getByRole("textbox", { name: "Attribute 1 name" });
    expect(document.activeElement).toBe(input);
    await user.type(input, "Customer ID");
    expect((input as HTMLInputElement).value).toBe("Customer ID");
    await user.click(screen.getByRole("button", { name: "Remove attribute Customer ID" }));
    expect(screen.queryByRole("textbox", { name: "Attribute 1 name" })).toBeNull();
  });

  it("enforces the six-attribute limit and explains it", async () => {
    const user = await renderWorkspaceWithExample();
    const add = screen.getByRole("button", { name: "Add attribute" });
    await user.click(add);
    await user.click(add);
    await user.click(add);
    expect(screen.getByText("6 / 6")).toBeTruthy();
    expect((add as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("The 6 attribute limit has been reached.")).toBeTruthy();
  });

  it("marks visual duplicate names after trimming and ignoring case", async () => {
    const user = await renderWorkspaceWithExample();
    const second = screen.getByRole("textbox", { name: "Attribute 2 name" });
    await user.clear(second);
    await user.type(second, " a ");
    expect(screen.getAllByText("Attribute names must be unique ignoring case and surrounding whitespace.")).toHaveLength(2);
    expect(screen.getByRole("textbox", { name: "Attribute 1 name" }).getAttribute("aria-invalid")).toBe("true");
    expect(second.getAttribute("aria-invalid")).toBe("true");
  });

  it("requires confirmation before removing a referenced attribute and cleans related dependencies", async () => {
    const user = await renderWorkspaceWithExample();
    await user.click(screen.getByRole("button", { name: "Remove attribute B" }));
    expect(screen.getByText("Removing “B” will also remove 2 dependencies.")).toBeTruthy();
    expect(screen.getByText("2 / 12")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove attribute" }));
    expect(screen.queryByRole("textbox", { name: "Attribute 3 name" })).toBeNull();
    expect(screen.getByText("0 / 12")).toBeTruthy();
  });

  it("creates simple and compound dependencies with checkbox groups", async () => {
    const user = await renderWorkspaceWithExample();
    await user.click(side("Determinant").getByRole("checkbox", { name: "A" }));
    await user.click(side("Dependent").getByRole("checkbox", { name: "C" }));
    await user.click(screen.getByRole("button", { name: "Add dependency" }));
    expect(screen.getByText("A → C")).toBeTruthy();

    await user.click(side("Determinant").getByRole("checkbox", { name: "A" }));
    await user.click(side("Determinant").getByRole("checkbox", { name: "B" }));
    await user.click(side("Dependent").getByRole("checkbox", { name: "C" }));
    await user.click(screen.getByRole("button", { name: "Add dependency" }));
    expect(screen.getByText("A, B → C")).toBeTruthy();
  });

  it("rejects a duplicate dependency independent of determinant selection order", async () => {
    const user = await renderWorkspaceWithExample();
    await user.click(side("Determinant").getByRole("checkbox", { name: "A" }));
    await user.click(side("Determinant").getByRole("checkbox", { name: "B" }));
    await user.click(side("Dependent").getByRole("checkbox", { name: "C" }));
    await user.click(screen.getByRole("button", { name: "Add dependency" }));
    await user.click(side("Determinant").getByRole("checkbox", { name: "B" }));
    await user.click(side("Determinant").getByRole("checkbox", { name: "A" }));
    await user.click(side("Dependent").getByRole("checkbox", { name: "C" }));
    await user.click(screen.getByRole("button", { name: "Add dependency" }));
    expect(screen.getByRole("alert").textContent).toContain("already exists");
    expect(screen.getByText("3 / 12")).toBeTruthy();
  });

  it("edits an existing dependency without recreating it", async () => {
    const user = await renderWorkspaceWithExample();
    await user.click(screen.getByRole("button", { name: "Edit dependency A → B" }));
    expect(screen.getByRole("heading", { name: "Edit dependency" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("A → B")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Edit dependency A → B" }));
    await user.click(side("Dependent").getByRole("checkbox", { name: "B" }));
    await user.click(side("Dependent").getByRole("checkbox", { name: "C" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("A → C")).toBeTruthy();
    expect(screen.queryByText("A → B")).toBeNull();
    expect(screen.getByText("2 / 12")).toBeTruthy();
  });

  it("removes a dependency without confirmation", async () => {
    const user = await renderWorkspaceWithExample();
    await user.click(screen.getByRole("button", { name: "Remove dependency A → B" }));
    expect(screen.queryByText("A → B")).toBeNull();
    expect(screen.getByText("1 / 12")).toBeTruthy();
  });

  it("supports an explicitly empty determinant", async () => {
    const user = await renderWorkspaceWithExample();
    await user.click(screen.getByRole("button", { name: "Add dependency" }));
    expect(screen.getByRole("alert").textContent).toContain("Select at least one determinant");
    await user.click(screen.getByText("Advanced dependency options"));
    await user.click(screen.getByRole("checkbox", { name: "Allow empty determinant" }));
    await user.click(side("Dependent").getByRole("checkbox", { name: "C" }));
    await user.click(screen.getByRole("button", { name: "Add dependency" }));
    expect(screen.getByText("∅ → C")).toBeTruthy();
  });

  it("supports an explicitly empty dependent", async () => {
    const user = await renderWorkspaceWithExample();
    await user.click(screen.getByText("Advanced dependency options"));
    await user.click(screen.getByRole("checkbox", { name: "Allow empty dependent" }));
    await user.click(side("Determinant").getByRole("checkbox", { name: "A" }));
    await user.click(screen.getByRole("button", { name: "Add dependency" }));
    expect(screen.getByText("A → ∅")).toBeTruthy();
  });

  it("loads the example directly when pristine and confirms before replacing edits", async () => {
    const user = userEvent.setup();
    render(<SchemaWorkspace />);
    const load = screen.getByRole("button", { name: "Load example" });
    load.focus();
    await user.keyboard("{Enter}");
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe("R");
    await user.clear(screen.getByRole("textbox", { name: "Relation name" }));
    await user.type(screen.getByRole("textbox", { name: "Relation name" }), "Orders");
    await user.click(load);
    expect(screen.getByText("Loading the example will replace your current schema.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Replace with example" }));
    expect((screen.getByRole("textbox", { name: "Relation name" }) as HTMLInputElement).value).toBe("R");
  });

  it("exposes technical IDs only through a keyboard-operable disclosure", async () => {
    const user = await renderWorkspaceWithExample();
    const advanced = screen.getAllByText("Advanced")[0];
    if (!advanced) throw new Error("Advanced attribute disclosure was not found");
    advanced.focus();
    await user.keyboard("{Enter}");
    const details = advanced.closest("details");
    if (!details) throw new Error("Advanced attribute details were not found");
    const id = within(details).getByRole("textbox", { name: "Technical ID" }) as HTMLInputElement;
    expect(id.readOnly).toBe(true);
    expect(id.value.startsWith("attr_")).toBe(true);
  });
});
