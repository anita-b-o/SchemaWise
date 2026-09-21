import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./SiteFooter";

describe("site footer", () => {
  it("renders the single brand signature with Pampa Software as an external link", () => {
    render(<SiteFooter />);

    const footer = screen.getByRole("contentinfo");
    expect(footer.textContent).toContain("Developed by Pampa Software");

    const link = screen.getByRole("link", { name: "Pampa Software" });
    expect(footer.querySelectorAll("a")).toHaveLength(1);
    expect(link.getAttribute("href")).toBe("https://pampasoftware.com.ar/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("has no axe violations when present", async () => {
    render(<SiteFooter />);

    const results = await axe.run(document.body);
    expect(results.violations).toHaveLength(0);
  });
});
