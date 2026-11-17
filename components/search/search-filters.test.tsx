import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MAX_FILTER_CHOICES, searchInput } from "@/lib/products/schemas";

import { SearchFilters } from "./search-filters";

const colors = Array.from({ length: MAX_FILTER_CHOICES + 2 }, (_, i) => `Color ${i + 1}`);
const categories = [
  { id: "550e8400-e29b-41d4-a716-446655440001", name: "Pants" },
  { id: "550e8400-e29b-41d4-a716-446655440002", name: "Shirts" },
  { id: "550e8400-e29b-41d4-a716-446655440003", name: "Hats" },
];

const field = <input aria-label="Search products" />;

describe("SearchFilters", () => {
  describe("sort", () => {
    it("offers Best match only with text, and marks the sort in use", () => {
      const { unmount } = render(<SearchFilters input={searchInput.parse({})} categories={[]} colors={[]} onChange={() => {}}>{field}</SearchFilters>);
      expect(screen.queryByRole("radio", { name: "Best match" })).toBeNull();
      expect(screen.getByRole("radio", { name: "Name A–Z" })).toBeChecked();
      unmount();
      render(<SearchFilters input={searchInput.parse({ q: "pant" })} categories={[]} colors={[]} onChange={() => {}}>{field}</SearchFilters>);
      expect(screen.getByRole("radio", { name: "Best match" })).toBeChecked();
    });

    it("changes the sort", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<SearchFilters input={searchInput.parse({})} categories={[]} colors={[]} onChange={onChange}>{field}</SearchFilters>);
      await user.click(screen.getByRole("radio", { name: "Recently updated" }));
      expect(onChange).toHaveBeenCalledWith({ sort: "updated" });
    });
  });

  describe("filter limits", () => {
    it("stops at the max colors and disables extras", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const input = searchInput.parse({ colors: colors.slice(0, MAX_FILTER_CHOICES) });
      render(<SearchFilters input={input} categories={[]} colors={colors} onChange={onChange}>{field}</SearchFilters>);

      const extra = screen.getByRole("checkbox", { name: `Color ${MAX_FILTER_CHOICES + 1}` });
      expect(extra).toBeDisabled();
      expect(screen.getByRole("checkbox", { name: "Color 1" })).toBeEnabled();
      expect(screen.getByText(`Up to ${MAX_FILTER_CHOICES} colors at once.`)).toBeInTheDocument();

      await user.click(extra);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("says nothing about a limit below the max", () => {
      render(<SearchFilters input={searchInput.parse({ colors: ["Color 1"] })} categories={[]} colors={colors} onChange={() => {}}>{field}</SearchFilters>);
      expect(screen.getByRole("checkbox", { name: `Color ${MAX_FILTER_CHOICES + 1}` })).toBeEnabled();
      expect(screen.queryByText(/^Up to/)).not.toBeInTheDocument();
    });
  });

  describe("filter state and onChange propagation", () => {
    it("reports a choice from every group", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<SearchFilters input={searchInput.parse({})} categories={categories} colors={["Black", "White", "Red"]} onChange={onChange}>{field}</SearchFilters>);

      await user.click(screen.getByRole("checkbox", { name: "In stock" }));
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ statuses: ["in_stock"] }));
      await user.click(screen.getByRole("checkbox", { name: "On the floor" }));
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ places: ["floor"] }));
      await user.click(screen.getByRole("checkbox", { name: "Pants" }));
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ categoryIds: ["550e8400-e29b-41d4-a716-446655440001"] }));
      await user.click(screen.getByRole("checkbox", { name: "Black" }));
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ colors: ["Black"] }));
    });

    it("toggles filters on and off", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const input = searchInput.parse({ colors: ["Black"] });
      render(<SearchFilters input={input} categories={[]} colors={["Black", "White"]} onChange={onChange}>{field}</SearchFilters>);

      await user.click(screen.getByRole("checkbox", { name: "Black" }));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ colors: [] }));
    });

    it("reflects current filter state in checkboxes", () => {
      const input = searchInput.parse({ colors: ["Black", "White"], categoryIds: ["550e8400-e29b-41d4-a716-446655440001"], statuses: ["in_stock"], places: ["floor"] });
      render(<SearchFilters input={input} categories={categories} colors={["Black", "White", "Red"]} onChange={() => {}}>{field}</SearchFilters>);

      expect(screen.getByRole("checkbox", { name: "Black" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "White" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Red" })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Pants" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "In stock" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "On the floor" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Stockroom" })).not.toBeChecked();
    });
  });

  describe("the Filters button and its menu", () => {
    const none = () => searchInput.parse({});
    const button = () => screen.getByRole("button", { name: "Filters" });

    // One component for every size: nothing here asks how wide the screen is.
    it("is one icon button beside the search field", () => {
      const { container } = render(<SearchFilters input={none()} categories={[]} colors={[]} onChange={() => {}}>{field}</SearchFilters>);
      expect(button()).toHaveTextContent("");
      expect(button().querySelector("svg")).not.toBeNull();
      expect(button().previousElementSibling).toContainElement(screen.getByLabelText("Search products"));
      expect(container.querySelector("details")).toBeNull();
    });

    it("starts folded and opens in place: aria-expanded, aria-controls, no dialog", async () => {
      const user = userEvent.setup();
      render(<SearchFilters input={none()} categories={[]} colors={["Black"]} onChange={() => {}}>{field}</SearchFilters>);
      const menu = document.getElementById(button().getAttribute("aria-controls") ?? "");
      expect(button()).toHaveAttribute("aria-expanded", "false");
      expect(menu).toContainElement(screen.getByRole("checkbox", { name: "Black" }));
      expect(menu).toHaveAttribute("inert");
      expect(menu).toHaveClass("grid-rows-[0fr]");
      await user.click(button());
      expect(button()).toHaveAttribute("aria-expanded", "true");
      expect(menu).not.toHaveAttribute("inert");
      expect(menu).toHaveClass("grid-rows-[1fr]");
      expect(screen.queryByRole("dialog")).toBeNull();
      await user.click(button());
      expect(button()).toHaveAttribute("aria-expanded", "false");
      expect(menu).toHaveAttribute("inert");
    });

    it("starts open when filters are already on, and stays open as a chip is unticked", async () => {
      const user = userEvent.setup();
      render(<SearchFilters input={searchInput.parse({ colors: ["Black"] })} categories={[]} colors={["Black"]} onChange={() => {}}>{field}</SearchFilters>);
      expect(button()).toHaveAttribute("aria-expanded", "true");
      await user.click(screen.getByRole("checkbox", { name: "Black" }));
      expect(button()).toHaveAttribute("aria-expanded", "true");
    });

    it("shows how many filters are on as a badge, and says so to a screen reader", () => {
      const input = searchInput.parse({ colors: ["Black"], categoryIds: ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"], statuses: ["in_stock"], places: [] });
      render(<SearchFilters input={input} categories={categories} colors={["Black"]} onChange={() => {}}>{field}</SearchFilters>);
      expect(button()).toHaveTextContent("4");
      expect(button()).toHaveAccessibleDescription("4 filters on");
    });

    it("has no badge when no filter is on", () => {
      render(<SearchFilters input={none()} categories={categories} colors={["Black"]} onChange={() => {}}>{field}</SearchFilters>);
      expect(button()).toHaveTextContent("");
      expect(button()).not.toHaveAttribute("aria-describedby");
    });
  });
});
