import { act, fireEvent, render, screen } from "@testing-library/react";
import { Home } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PaletteGroup, PaletteItem } from "@/lib/palette/types";

import { PaletteList } from "./palette-list";
import type { ProductsState } from "./use-palette-data";

const page = (id: string, label: string): PaletteItem => ({ kind: "page", id: `page:${id}`, label, keywords: "", icon: Home, target: { href: id } });
const all: PaletteItem = { kind: "all-products", id: "all-products", label: 'All products matching "navy"', keywords: "", href: "/products?q=navy" };
const goto: PaletteGroup = { key: "goto", heading: "Go to", items: [page("/home", "Home"), page("/store", "Store")] };

type Props = Partial<React.ComponentProps<typeof PaletteList>> & { state?: ProductsState; searching?: boolean };
function list({ state = "idle", searching = false, ...props }: Props = {}) {
  return (
    <PaletteList query="" onQueryChange={vi.fn()} groups={[goto]} products={{ state, searching }} onPick={vi.fn()} onClose={vi.fn()} {...props} />
  );
}

afterEach(() => vi.useRealTimers());

describe("PaletteList: rows that are not options", () => {
  const products: PaletteGroup = { key: "products", heading: "Products", items: [all] };

  it("the searching row is text, not an option", () => {
    render(list({ query: "navy", groups: [products], state: "loading", searching: true }));
    expect(screen.getByText("Searching products…")).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.queryByText(/No matches/)).not.toBeInTheDocument();
  });

  it("a failed search is said inline under Products", () => {
    render(list({ query: "navy", groups: [products], state: "error" }));
    expect(screen.getByText(/Couldn.t search products\. Check your connection\./)).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("neither status row is inside the listbox", () => {
    const { rerender } = render(list({ query: "navy", groups: [products], state: "loading", searching: true }));
    const box = screen.getByRole("listbox");
    expect(box).not.toContainElement(screen.getByText("Searching products…"));
    rerender(list({ query: "navy", groups: [products], state: "error" }));
    expect(box).not.toContainElement(screen.getByText(/Couldn.t search products/));
  });

  it("says no matches once settled, and keeps All products", () => {
    render(list({ query: "navy", groups: [products], state: "ready" }));
    expect(screen.getByText(/No matches for/)).toHaveTextContent("No matches for “navy”.");
    expect(screen.getByRole("option", { name: /All products matching/ })).toBeInTheDocument();
  });

  it("says no matches for a query that is not text, with nothing to open", () => {
    render(list({ query: "!", groups: [], state: "idle" }));
    expect(screen.getByText(/No matches for/)).toBeVisible();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});

describe("PaletteList: option ids and IME", () => {
  it("option ids come from the item, so the active descendant changes when the item at a position does", () => {
    const { rerender } = render(list({ groups: [{ key: "goto", heading: "Go to", items: [page("/home", "Home")] }] }));
    const before = screen.getByRole("combobox").getAttribute("aria-activedescendant");
    rerender(list({ groups: [{ key: "goto", heading: "Go to", items: [page("/store", "Store")] }] }));
    const after = screen.getByRole("combobox").getAttribute("aria-activedescendant");
    expect(after).not.toBe(before);
    expect(document.getElementById(after!)).toHaveTextContent("Store");
  });

  it("Enter with keyCode 229 (Safari's composing) belongs to the IME", () => {
    const onPick = vi.fn();
    render(list({ onPick }));
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter", keyCode: 229 });
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter", keyCode: 13 });
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});

describe("PaletteList: the announcement", () => {
  it("speaks once after the answer settles, not per keystroke", () => {
    vi.useFakeTimers();
    const { rerender } = render(list({ query: "ho", groups: [goto], state: "loading" }));
    expect(screen.getByRole("status")).toHaveTextContent("");
    rerender(list({ query: "ho", groups: [goto], state: "ready" }));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("status")).toHaveTextContent("");
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("status")).toHaveTextContent("2 pages and actions");
  });

  it("says when nothing matched", () => {
    vi.useFakeTimers();
    render(list({ query: "denm", groups: [], state: "idle" }));
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByRole("status")).toHaveTextContent('No matches for "denm".');
  });
});
