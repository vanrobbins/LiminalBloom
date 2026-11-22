import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home } from "lucide-react";
import { useState } from "react";
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

  it("with only All products and the answer on its way nothing is highlighted, so Enter does nothing; the first product then gets it", async () => {
    const onPick = vi.fn();
    const placeholder: PaletteGroup = { key: "products", heading: "Products", items: [all] };
    const { rerender } = render(list({ query: "navy", groups: [placeholder], state: "loading", onPick }));
    expect(selected()).toBeUndefined();
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant");
    await userEvent.type(screen.getByRole("combobox"), "{Enter}");
    expect(onPick).not.toHaveBeenCalled();
    rerender(list({ query: "navy", groups: [products], state: "ready", onPick }));
    expect(selected()).toBe("Navy TeeNT-1 · Front table");
  });

  it("settled with no products, All products is highlighted and stays; a planogram that lands after it takes over", () => {
    const placeholder: PaletteGroup = { key: "products", heading: "Products", items: [all] };
    const { rerender } = render(list({ query: "rack", groups: [placeholder], state: "ready" }));
    expect(selected()).toBe('All products matching "navy"');
    rerender(list({ query: "rack", groups: [{ key: "planograms", heading: "Planograms", items: [planogram] }, placeholder], state: "ready" }));
    expect(selected()).toBe("Rack 1Men · Draft");
  });

  it("typing again starts over: the default skips All products once something else is there", async () => {
    const placeholder: PaletteGroup = { key: "products", heading: "Products", items: [all] };
    function Host() {
      const [q, setQ] = useState("na");
      return list({ query: q, onQueryChange: setQ, groups: q === "na" ? [placeholder] : [placeholder, goto], state: "loading" });
    }
    render(<Host />);
    expect(selected()).toBeUndefined();
    await userEvent.type(screen.getByRole("combobox"), "v");
    expect(selected()).toBe("Home");
  });

  it("starts on the first real option, not on All products, when there is one", () => {
    render(list({ query: "store", groups: [{ key: "products", heading: "Products", items: [all] }, goto], state: "loading" }));
    expect(selected()).toBe("Home");
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
