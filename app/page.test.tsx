import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("the landing page", () => {
  it("has one Sign in and one Create an account link, as the e2e spec finds them", () => {
    render(<Home />);
    // Playwright matches names by substring, so a second "Sign in …" link would make it ambiguous.
    const signIn = screen.getAllByRole("link", { name: /sign in/i });
    const signUp = screen.getAllByRole("link", { name: /create an account/i });
    expect(signIn).toHaveLength(1);
    expect(signIn[0]).toHaveAttribute("href", "/sign-in");
    expect(signUp).toHaveLength(1);
    expect(signUp[0]).toHaveAttribute("href", "/sign-up");
  });

  it("makes Sign in the one gold action", () => {
    render(<Home />);
    const primary = screen.getAllByRole("link").filter((link) => /\bbg-brand\b/.test(link.className));
    expect(primary.map((link) => link.textContent)).toEqual(["Sign in"]);
  });

  it("uses headings in order: one h1, then sections, then features", () => {
    const { container } = render(<Home />);
    const levels = [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((h) => Number(h.tagName[1]));
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.forEach((level, i) => {
      if (i > 0) expect(level - levels[i - 1]).toBeLessThanOrEqual(1);
    });
  });

  it("describes the drawn planogram in words beside it", () => {
    render(<Home />);
    const figure = screen.getByRole("figure");
    expect(figure.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(figure).toHaveTextContent("Rack 2 · Center · Top rail");
  });
});
