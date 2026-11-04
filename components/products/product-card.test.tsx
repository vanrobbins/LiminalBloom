import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProductRow } from "@/lib/products/queries";

import { ProductCard } from "./product-card";

const row: ProductRow = {
  id: "6f1c3b4e-8a43-4b8e-9b5d-4f7c2a1e9d10", name: "High-Rise Pant", styleNumber: "HRP-01", color: "Black", sizeRange: "24–34",
  status: "sold_out", version: 3, categoryId: "c", categoryName: "Pants", imageKey: null, sizeIsOwn: false, swatch: null, texture: "solid",
};

describe("ProductCard", () => {
  it("is one link to the product: photo first, then name, category and status", () => {
    render(<ProductCard product={row} />);
    const card = screen.getByRole("link", { name: /High-Rise Pant/ });
    expect(card).toHaveAttribute("href", `/products/${row.id}`);
    expect(card).toHaveTextContent("Pants · Black");
    expect(within(card).getByText("Sold out")).toBeInTheDocument();
    // The photo (here the silhouette) comes before the name.
    const [image] = card.querySelectorAll("svg, img");
    expect(image.compareDocumentPosition(within(card).getByText("High-Rise Pant")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
