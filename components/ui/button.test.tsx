import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("is a plain button by default, so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("disables itself and shows the loading text while loading", () => {
    render(
      <Button type="submit" loading loadingText="Signing in…">
        Sign in
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Signing in…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("renders its child link with button styling when asChild", () => {
    render(
      <Button asChild>
        <a href="/sign-in">Sign in</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/sign-in");
    expect(link.className).toContain("min-h-11");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["primary", "secondary", "ghost", "danger"] as const)(
    "keeps the 44px minimum as %s",
    (variant) => {
      render(<Button variant={variant}>Go</Button>);
      expect(screen.getByRole("button").className).toContain("min-h-11");
    },
  );

  it("is a 44px square with no side padding as an icon button", () => {
    // Side padding would squeeze the icon: a caller's px-0 cannot override
    // the base px-4, since classes are added, never merged.
    render(
      <Button icon aria-label="Switch to dark">
        <svg />
      </Button>,
    );
    const { className } = screen.getByRole("button", { name: "Switch to dark" });
    expect(className).toContain("size-11");
    expect(className).not.toContain("px-4");
  });

  it("keeps a caller's extra classes", () => {
    render(<Button className="w-full">Go</Button>);
    expect(screen.getByRole("button").className).toContain("w-full");
  });
});
