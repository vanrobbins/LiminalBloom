import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SearchField } from "./search-field";

describe("SearchField", () => {
  it("is the Products search box: label, type, name, hint and keyboard key", () => {
    render(<SearchField />);
    const field = screen.getByRole("searchbox", { name: "Search products" });
    expect(field).toHaveAttribute("name", "q");
    expect(field).toHaveAttribute("autocomplete", "off");
    expect(field).toHaveAttribute("enterkeyhint", "search");
    expect(field).toHaveAccessibleDescription("Name, style number, category or color.");
  });

  it("passes a controlled value and its handler through", () => {
    render(<SearchField value="dress" onChange={() => {}} />);
    expect(screen.getByRole("searchbox")).toHaveValue("dress");
  });
});
