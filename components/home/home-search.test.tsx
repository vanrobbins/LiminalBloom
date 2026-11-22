import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/form", () => ({
  default: ({ action, children, ...props }: React.ComponentProps<"form"> & { action: string }) => (
    <form data-action={action} {...props}>
      {children}
    </form>
  ),
}));

import { HomeSearch } from "./home-search";

describe("HomeSearch", () => {
  it("is a search landmark that sends the field's q to /products", () => {
    const { container } = render(<HomeSearch />);
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("data-action", "/products");
    expect(container.querySelector("form input[name='q']")).toBe(screen.getByRole("searchbox", { name: "Search products" }));
  });

  it("has no submit button: the keyboard's search key submits", () => {
    render(<HomeSearch />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not take focus, so a phone's keyboard stays down over the cards", () => {
    render(<HomeSearch />);
    const field = screen.getByRole("searchbox");
    expect(field).not.toHaveFocus();
    expect(field).not.toHaveAttribute("autofocus");
    expect(document.activeElement).toBe(document.body);
  });
});
