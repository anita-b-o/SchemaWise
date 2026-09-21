import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./SiteFooter";

describe("site footer", () => {
  it("renders the single brand signature without adding a link", () => {
    render(<SiteFooter />);

    const footer = screen.getByRole("contentinfo");
    expect(footer.textContent).toContain("Developed by Pampa Software");
    expect(footer.querySelector("a")).toBeNull();
  });

  it("has no axe violations when present", async () => {
    render(<SiteFooter />);

    const results = await axe.run(document.body);
    expect(results.violations).toHaveLength(0);
  });
});
