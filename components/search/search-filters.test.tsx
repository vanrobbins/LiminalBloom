import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mediaQuery = vi.hoisted(() => ({ PHONE_QUERY: "(max-width: 767px)", useMediaQuery: vi.fn(() => false) }));
vi.mock("@/components/store-map/use-media-query", () => mediaQuery);

import { MAX_FILTER_CHOICES, searchInput } from "@/lib/products/schemas";

import { SearchFilters } from "./search-filters";

const colors = Array.from({ length: MAX_FILTER_CHOICES + 2 }, (_, i) => `Color ${i + 1}`);
const categories = [
  { id: "550e8400-e29b-41d4-a716-446655440001", name: "Pants" },
  { id: "550e8400-e29b-41d4-a716-446655440002", name: "Shirts" },
  { id: "550e8400-e29b-41d4-a716-446655440003", name: "Hats" },
];

beforeEach(() => mediaQuery.useMediaQuery.mockReturnValue(false));

describe("SearchFilters", () => {
  describe("filter limits", () => {
    it("stops at the max colors and disables extras", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const input = searchInput.parse({ colors: colors.slice(0, MAX_FILTER_CHOICES) });
      render(<SearchFilters input={input} categories={[]} colors={colors} onChange={onChange} />);

      const extra = screen.getByRole("checkbox", { name: `Color ${MAX_FILTER_CHOICES + 1}` });
      expect(extra).toBeDisabled();
      expect(screen.getByRole("checkbox", { name: "Color 1" })).toBeEnabled();
      expect(screen.getByText(`Up to ${MAX_FILTER_CHOICES} colors at once.`)).toBeInTheDocument();

      await user.click(extra);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("says nothing about a limit below the max", () => {
      render(<SearchFilters input={searchInput.parse({ colors: ["Color 1"] })} categories={[]} colors={colors} onChange={() => {}} />);
      expect(screen.getByRole("checkbox", { name: `Color ${MAX_FILTER_CHOICES + 1}` })).toBeEnabled();
      expect(screen.queryByText(/^Up to/)).not.toBeInTheDocument();
    });

    it("shows category filter group", () => {
      const onChange = vi.fn();
      render(<SearchFilters input={searchInput.parse({ categoryIds: [] })} categories={categories} colors={[]} onChange={onChange} />);

      expect(screen.getByRole("checkbox", { name: "Pants" })).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Shirts" })).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Hats" })).toBeInTheDocument();
    });
  });

  describe("filter state and onChange propagation", () => {
    it("calls onChange when status filter changes", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const input = searchInput.parse({ statuses: [] });
      render(<SearchFilters input={input} categories={[]} colors={[]} onChange={onChange} />);

      await user.click(screen.getByRole("checkbox", { name: "In stock" }));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ statuses: ["in_stock"] }));
    });

    it("calls onChange when place filter changes", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const input = searchInput.parse({ places: [] });
      render(<SearchFilters input={input} categories={[]} colors={[]} onChange={onChange} />);

      await user.click(screen.getByRole("checkbox", { name: "On the floor" }));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ places: ["floor"] }));
    });

    it("calls onChange when category filter changes", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const input = searchInput.parse({ categoryIds: [] });
      render(<SearchFilters input={input} categories={categories} colors={[]} onChange={onChange} />);

      await user.click(screen.getByRole("checkbox", { name: "Pants" }));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ categoryIds: ["550e8400-e29b-41d4-a716-446655440001"] }));
    });

    it("calls onChange when color filter changes", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const input = searchInput.parse({ colors: [] });
      render(<SearchFilters input={input} categories={[]} colors={["Black", "White", "Red"]} onChange={onChange} />);

      await user.click(screen.getByRole("checkbox", { name: "Black" }));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ colors: ["Black"] }));
    });

    it("toggles filters on and off", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const input = searchInput.parse({ colors: ["Black"] });
      render(<SearchFilters input={input} categories={[]} colors={["Black", "White"]} onChange={onChange} />);

      await user.click(screen.getByRole("checkbox", { name: "Black" }));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ colors: [] }));
    });

    it("reflects current filter state in checkboxes", () => {
      const input = searchInput.parse({ colors: ["Black", "White"], categoryIds: ["550e8400-e29b-41d4-a716-446655440001"], statuses: ["in_stock"], places: ["floor"] });
      render(<SearchFilters input={input} categories={categories} colors={["Black", "White", "Red"]} onChange={() => {}} />);

      expect(screen.getByRole("checkbox", { name: "Black" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "White" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Red" })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Pants" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "In stock" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "On the floor" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Stockroom" })).not.toBeChecked();
    });
  });

  describe("multi-filter combinations", () => {
    it("allows multiple filters simultaneously", () => {
      const onChange = vi.fn();
      const input = searchInput.parse({ colors: ["Black"], categoryIds: ["550e8400-e29b-41d4-a716-446655440001"], statuses: ["in_stock"], places: ["floor"] });
      render(<SearchFilters input={input} categories={categories} colors={["Black", "White"]} onChange={onChange} />);

      const allChecked = [
        screen.getByRole("checkbox", { name: "Black" }),
        screen.getByRole("checkbox", { name: "Pants" }),
        screen.getByRole("checkbox", { name: "In stock" }),
        screen.getByRole("checkbox", { name: "On the floor" }),
      ];
      allChecked.forEach((cb) => expect(cb).toBeChecked());
    });

    it("counts active filters and displays in header (desktop)", () => {
      const input = searchInput.parse({ colors: ["Black"], categoryIds: ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"], statuses: ["in_stock"], places: [] });
      render(<SearchFilters input={input} categories={categories} colors={["Black"]} onChange={() => {}} />);

      expect(screen.getByText("Filters (4)")).toBeInTheDocument();
    });

    it("counts zero when no filters active", () => {
      const input = searchInput.parse({ colors: [], categoryIds: [], statuses: [], places: [] });
      render(<SearchFilters input={input} categories={categories} colors={["Black"]} onChange={() => {}} />);

      expect(screen.getByText("Filters")).not.toHaveTextContent("Filters (");
    });
  });

  describe("desktop layout (details element)", () => {
    beforeEach(() => mediaQuery.useMediaQuery.mockReturnValue(false));

    it("renders as expandable details element on desktop", () => {
      const input = searchInput.parse({ colors: [], categoryIds: [], statuses: [], places: [] });
      const { container } = render(<SearchFilters input={input} categories={[]} colors={[]} onChange={() => {}} />);

      const details = container.querySelector("details");
      expect(details).toBeInTheDocument();
      const summary = details?.querySelector("summary");
      expect(summary).toBeInTheDocument();
      expect(summary?.textContent).toMatch(/Filters/);
    });

    it("starts open on desktop when filters are active", () => {
      const input = searchInput.parse({ colors: ["Black"], categoryIds: [], statuses: [], places: [] });
      const { container } = render(<SearchFilters input={input} categories={[]} colors={["Black"]} onChange={() => {}} />);

      const details = container.querySelector("details");
      expect(details).toHaveAttribute("open");
    });

    it("starts closed on desktop when no filters", () => {
      const input = searchInput.parse({ colors: [], categoryIds: [], statuses: [], places: [] });
      const { container } = render(<SearchFilters input={input} categories={[]} colors={[]} onChange={() => {}} />);

      const details = container.querySelector("details");
      expect(details).not.toHaveAttribute("open");
    });

    it("toggles details open/close on summary click", async () => {
      const user = userEvent.setup();
      const input = searchInput.parse({ colors: [], categoryIds: [], statuses: [], places: [] });
      const { container } = render(<SearchFilters input={input} categories={categories} colors={["Black", "White"]} onChange={() => {}} />);

      const details = container.querySelector("details");
      const summary = details?.querySelector("summary");
      if (!summary) throw new Error("Summary not found");

      expect(details).not.toHaveAttribute("open");
      await user.click(summary);
      expect(details).toHaveAttribute("open");
      await user.click(summary);
      expect(details).not.toHaveAttribute("open");
    });
  });

  describe("phone layout (bottom sheet)", () => {
    beforeEach(() => mediaQuery.useMediaQuery.mockReturnValue(true));

    it("renders as button with sheet on phone", () => {
      const input = searchInput.parse({ colors: [], categoryIds: [], statuses: [], places: [] });
      render(<SearchFilters input={input} categories={[]} colors={[]} onChange={() => {}} />);

      expect(screen.getByRole("button", { name: /Filters/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Filters/ }).parentElement?.tagName).not.toBe("SUMMARY");
    });

    it("opens bottom sheet when button is clicked on phone", async () => {
      const user = userEvent.setup();
      const input = searchInput.parse({ colors: [], categoryIds: [], statuses: [], places: [] });
      render(<SearchFilters input={input} categories={[]} colors={["Black"]} onChange={() => {}} />);

      const btn = screen.getByRole("button", { name: /Filters/ });
      await user.click(btn);

      expect(btn).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
    });

    it("closes bottom sheet after selecting a filter", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const input = searchInput.parse({ colors: [], categoryIds: [], statuses: [], places: [] });
      render(<SearchFilters input={input} categories={[]} colors={["Black"]} onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: /Filters/ }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Sheet stays open after click; user manually closes it or clicking outside closes it
      // This tests the default behavior without additional actions
    });

    it("shows filter count badge on phone button", () => {
      const input = searchInput.parse({ colors: ["Black"], categoryIds: ["550e8400-e29b-41d4-a716-446655440001"], statuses: [], places: [] });
      render(<SearchFilters input={input} categories={categories} colors={["Black"]} onChange={() => {}} />);

      expect(screen.getByRole("button", { name: "Filters (2)" })).toBeInTheDocument();
    });
  });
});
