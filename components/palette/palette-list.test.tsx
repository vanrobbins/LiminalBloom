import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PaletteGroup, PaletteItem } from "@/lib/palette/types";

import { PaletteList } from "./palette-list";
import type { ProductsState } from "./use-palette-data";

const page = (id: string, label: string): PaletteItem => ({ kind: "page", id: `page:${id}`, label, keywords: "", icon: Home, target: { href: id } });
const planogram: PaletteItem = { kind: "planogram", id: "planogram:f1", label: "Rack 1", keywords: "", second: "Men · Draft", href: "/planograms/f1" };
const all: PaletteItem = { kind: "all-products", id: "all-products", label: 'All products matching "navy"', keywords: "", href: "/products?q=navy" };
const tee: PaletteItem = { kind: "product", id: "product:p1", label: "Navy Tee", keywords: "", styleNumber: "NT-1", status: "in_stock", place: "Front table", more: 0, href: "/products?open=p1" };
const goto: PaletteGroup = { key: "goto", heading: "Go to", items: [page("/home", "Home"), page("/store", "Store")] };

type Props = Partial<React.ComponentProps<typeof PaletteList>> & { state?: ProductsState; searching?: boolean };
function list({ state = "idle", searching = false, ...props }: Props = {}) {
  return (
    <PaletteList query="" onQueryChange={vi.fn()} groups={[goto]} products={{ state, searching }} onPick={vi.fn()} onClose={vi.fn()} {...props} />
  );
}
const selected = () => screen.getAllByRole("option").find((o) => o.getAttribute("aria-selected") === "true")?.textContent;

afterEach(() => vi.useRealTimers());

describe("PaletteList: the field", () => {
  it("is a combobox over a labelled listbox, with the active option as its descendant", () => {
    render(list());
    const field = screen.getByRole("combobox", { name: "Search products, planograms, zones and pages" });
    expect(field).toHaveAttribute("aria-autocomplete", "list");
    expect(field).toHaveAttribute("aria-expanded", "true");
    expect(field).toHaveAttribute("maxlength", "80");
    expect(field).toHaveAttribute("aria-controls", screen.getByRole("listbox", { name: "Results" }).id);
    expect(field).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0].id);
    expect(screen.getByRole("group", { name: "Go to" })).toBeInTheDocument();
  });

  it("reports typing and the Close button", async () => {
    const onQueryChange = vi.fn();
    const onClose = vi.fn();
    render(list({ onQueryChange, onClose }));
    await userEvent.type(screen.getByRole("combobox"), "a");
    expect(onQueryChange).toHaveBeenCalledWith("a");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("PaletteList: keys", () => {
  it("arrows move without wrapping, Home and End jump, Enter opens the active option", async () => {
    const onPick = vi.fn();
    render(list({ onPick }));
    const field = screen.getByRole("combobox");
    await userEvent.type(field, "{ArrowUp}");
    expect(selected()).toBe("Home");
    await userEvent.type(field, "{ArrowDown}{ArrowDown}");
    expect(selected()).toBe("Store");
    await userEvent.type(field, "{Home}");
    expect(selected()).toBe("Home");
    await userEvent.type(field, "{End}{Enter}");
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "page:/store" }));
  });

  it("Enter with no options does nothing", async () => {
    const onPick = vi.fn();
    render(list({ onPick, groups: [] }));
    await userEvent.type(screen.getByRole("combobox"), "{Enter}");
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant");
  });

  it("leaves keys to the IME while composing", () => {
    const onPick = vi.fn();
    render(list({ onPick }));
    const field = screen.getByRole("combobox");
    fireEvent.keyDown(field, { key: "ArrowDown", isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    expect(onPick).not.toHaveBeenCalled();
    expect(selected()).toBe("Home");
  });

  it("a click picks, hover moves the highlight, typing puts it back on the top", async () => {
    const onPick = vi.fn();
    const { rerender } = render(list({ onPick }));
    await userEvent.hover(screen.getAllByRole("option")[1]);
    expect(selected()).toBe("Store");
    await userEvent.click(screen.getAllByRole("option")[1]);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "page:/store" }));
    await userEvent.type(screen.getByRole("combobox"), "s");
    rerender(list({ onPick, query: "s" }));
    expect(selected()).toBe("Home");
  });
});

describe("PaletteList: the highlight stays on what it was on", () => {
  const products: PaletteGroup = { key: "products", heading: "Products", items: [tee, all] };

  it("products that arrive above it do not move it", async () => {
    const { rerender } = render(list({ query: "ho", groups: [{ key: "planograms", heading: "Planograms", items: [planogram] }, goto], state: "loading" }));
    await userEvent.type(screen.getByRole("combobox"), "{ArrowDown}");
    expect(selected()).toBe("Home");
    rerender(list({ query: "ho", groups: [{ key: "planograms", heading: "Planograms", items: [planogram] }, products, goto], state: "ready" }));
    expect(selected()).toBe("Home");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toContain("Navy TeeNT-1 · Front table");
  });

  it("an unmoved highlight on the All products placeholder follows the first product that lands", () => {
    const placeholder: PaletteGroup = { key: "products", heading: "Products", items: [all] };
    const { rerender } = render(list({ query: "navy", groups: [placeholder], state: "loading" }));
    expect(selected()).toBe('All products matching "navy"');
    rerender(list({ query: "navy", groups: [products], state: "ready" }));
    expect(selected()).toBe("Navy TeeNT-1 · Front table");
  });

  it("but one the person moved onto All products stays there", async () => {
    const withTwo: PaletteGroup = { key: "products", heading: "Products", items: [all, page("/x", "Other")] };
    const { rerender } = render(list({ query: "navy", groups: [withTwo], state: "loading" }));
    await userEvent.type(screen.getByRole("combobox"), "{ArrowDown}{ArrowUp}");
    rerender(list({ query: "navy", groups: [{ key: "products", heading: "Products", items: [tee, all, page("/x", "Other")] }], state: "ready" }));
    expect(selected()).toBe('All products matching "navy"');
  });

  it("falls to the first option when the highlighted one disappears", async () => {
    const { rerender } = render(list());
    await userEvent.type(screen.getByRole("combobox"), "{ArrowDown}");
    rerender(list({ groups: [{ key: "goto", heading: "Go to", items: [page("/home", "Home")] }] }));
    expect(selected()).toBe("Home");
  });
});

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
