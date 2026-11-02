import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

// On this branch the index is the prototype walkthrough, not the landing page.
describe("the index page", () => {
  it("opens on the walkthrough's first chapter, with one h1", () => {
    render(<Home />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Keep the floor matching the plan");
  });

  it("links to the live app, since / is the walkthrough itself", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Open the live app" })).toHaveAttribute(
      "href",
      "https://liminalbloom.vanar.me",
    );
  });

  it("never names a project week", () => {
    const { container } = render(<Home />);
    expect(container.textContent).not.toMatch(/\bweeks? \d/i);
  });
});
