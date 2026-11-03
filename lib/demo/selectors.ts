// Questions the demo screens ask of the store: find a product, where is it,
// what is sold out but still on display, and what could fill its space.

import { checkSpot, sizeFor } from "./grid";
import type { DemoState, Placement, Product } from "./types";
import { faceOf } from "./words";

/**
 * Every word typed must appear, letters in order, inside some word of the
 * product's name, style, category or colour. Forgives dropped letters:
 * "hi rise pnt" finds the High-rise pant.
 */
export function searchProducts(products: Product[], query: string): Product[] {
  const typed = query.toLowerCase().split(/\s+/).filter(Boolean);
  const byName = [...products].sort((a, b) => a.name.localeCompare(b.name));
  if (typed.length === 0) return byName;
  const inOrder = (needle: string, word: string) => {
    let i = 0;
    for (const letter of word) if (letter === needle[i]) i += 1;
    return i === needle.length;
  };
  const matches = (text: string) => {
    const words = text.toLowerCase().split(/[\s-]+/);
    return typed.every((needle) => words.some((word) => inOrder(needle, word)));
  };
  // Name matches first, then ones found through style, category or colour.
  const found = byName.filter((p) => matches(`${p.name} ${p.style} ${p.category} ${p.colour}`));
  return [...found.filter((p) => matches(p.name)), ...found.filter((p) => !matches(p.name))];
}

export function placementOf(state: DemoState, productId: string): Placement | undefined {
  return state.published.find((p) => p.productId === productId);
}

export function productOf(state: DemoState, productId: string): Product {
  const product = state.products.find((p) => p.id === productId);
  if (!product) throw new Error(`No product ${productId}`);
  return product;
}

/** Published spots held by a sold-out product: the gaps Quick Adjust fills. */
export function soldOutOnDisplay(state: DemoState): Placement[] {
  return state.published.filter((p) => productOf(state, p.productId).status === "sold_out");
}

/** In-stock products with no published place yet. */
export function notPlaced(state: DemoState): Product[] {
  return state.products.filter((p) => p.status !== "sold_out" && !placementOf(state, p.id));
}

/**
 * Replacements for a gap: available, not on display anywhere, and fitting the
 * gap's space at its start. Same category first, then same colour.
 */
export function suggestionsFor(state: DemoState, gap: Placement): Product[] {
  const gone = productOf(state, gap.productId);
  const others = state.published.filter((p) => p.fixtureId === gap.fixtureId && p.id !== gap.id);
  const fits = (product: Product) =>
    checkSpot(faceOf(gap), others, { faceId: gap.faceId, col: gap.col, row: gap.row, ...sizeFor(product, gap.presentation) }).ok;
  const rank = (product: Product) => (product.category === gone.category ? 0 : product.colour === gone.colour ? 1 : 2);
  return notPlaced(state)
    .filter((p) => p.id !== gone.id && rank(p) < 2 && fits(p))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
